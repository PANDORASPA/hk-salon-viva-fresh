import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { bookingDatabase, createSql, callSql, futureSlot, rpcClient, ownerId, otherId } from './helpers/booking-database.mjs'

test('full migration chain replays and legacy return-type replacement is callable', async t => {
  const db = await bookingDatabase(t, { bindCustomer: false })
  const result = (await db.query(`select pg_get_function_result('public.deduct_package_session(bigint,bigint)'::regprocedure) as result`)).rows[0]
  assert.equal(result.result, 'package_redemptions')
  const row = await createSql(db)
  assert.ok(row.id)
  await assert.rejects(createSql(db, { p_customer_id: 1, p_actor_id: ownerId, p_customer_package_id: 1, p_source: 'account' }), error => error.message === 'ownership_forbidden')
})

test('removing the explicit historical DROP reproduces the PostgreSQL return-type replay defect', async t => {
  await assert.rejects(bookingDatabase(t, { migrationTransform: (file, sql) => file.endsWith('_package_redeem_rpc.sql')
    ? sql.replace('drop function if exists public.deduct_package_session(bigint, bigint);', '') : sql }),
  error => error.code === '42P13' && /cannot change return type/.test(error.message))
})

test('any-staff ranks by booking count, then sort_order/id, and retries a colliding candidate', async t => {
  const db = await bookingDatabase(t)
  const first = await createSql(db, { p_staff_preference: '1' })
  // Balance the counts using a different time. First candidate now collides;
  // the second candidate must still be attempted after the SQL exception.
  await createSql(db, { p_staff_preference: '2', p_starts_at: await futureSlot(db, 3, '14:00') })
  const retry = await createSql(db)
  assert.equal(first.staff_id, 1)
  assert.equal(retry.staff_id, 2)
  await assert.rejects(createSql(db), error => error.message === 'slot_unavailable')
  assert.equal((await db.query('select count(*)::int as count from public.appointments')).rows[0].count, 3)
  const ranked = await createSql(db, { p_starts_at: await futureSlot(db, 4) })
  assert.equal(ranked.staff_id, 1)
  await db.exec('update public.staff set sort_order=10 where id=1')
  assert.equal((await createSql(db, { p_starts_at: await futureSlot(db, 5) })).staff_id, 2)
  await db.exec('update public.staff set sort_order=0')
  assert.equal((await createSql(db, { p_starts_at: await futureSlot(db, 6) })).staff_id, 1)
})

test('submit rechecks service, lead/horizon, slot grid, shop/staff hours, blocks and time off', async t => {
  const db = await bookingDatabase(t)
  const start = await futureSlot(db)
  for (const time of ['09:30', '10:15', '18:00']) {
    await assert.rejects(createSql(db, { p_starts_at: await futureSlot(db, 3, time) }), error => ['slot_unavailable', 'booking_window_invalid'].includes(error.message))
  }
  for (const days of [-1, 91]) await assert.rejects(createSql(db, { p_starts_at: await futureSlot(db, days) }), error => error.message === 'booking_window_invalid')
  await db.exec('update public.services set published=false where id=1')
  await assert.rejects(createSql(db), error => error.message === 'service_unavailable')
  await db.exec('update public.services set published=true where id=1; update public.staff set is_active=false where id=1')
  await assert.rejects(createSql(db, { p_staff_preference: '1' }), error => error.message === 'slot_unavailable')
  await db.exec('update public.staff set is_active=true; delete from public.staff_services where staff_id=1 and service_id=1')
  await assert.rejects(createSql(db, { p_staff_preference: '1' }), error => error.message === 'slot_unavailable')
  await db.exec('insert into public.staff_services values (1,1); update public.staff_weekly_hours set starts_at=\'11:00\' where staff_id=1')
  await assert.rejects(createSql(db, { p_staff_preference: '1' }), error => error.message === 'slot_unavailable')
  await db.exec("update public.staff_weekly_hours set starts_at='10:00' where staff_id=1")
  await db.query(`insert into public.staff_time_off(staff_id,starts_at,ends_at) values (1,$1::timestamptz+interval '1 hour',$1::timestamptz+interval '2 hours')`, [start])
  await assert.rejects(createSql(db, { p_staff_preference: '1' }), error => error.message === 'slot_unavailable')
  await db.query(`insert into public.blocked_dates(starts_on,ends_on) values (($1::timestamptz at time zone 'Asia/Hong_Kong')::date,($1::timestamptz at time zone 'Asia/Hong_Kong')::date)`, [start])
  await assert.rejects(createSql(db), error => error.message === 'slot_unavailable')
})

const packageInput = { p_customer_id: 1, p_actor_id: ownerId, p_customer_package_id: 1, p_source: 'account' }
test('package ownership, applicability, expiry and balance are validated in the insert transaction', async t => {
  const db = await bookingDatabase(t)
  await assert.rejects(createSql(db, { ...packageInput, p_actor_id: null }), error => error.message === 'authentication_required')
  await assert.rejects(createSql(db, { ...packageInput, p_actor_id: otherId }), error => error.message === 'ownership_forbidden')
  await assert.rejects(createSql(db, { ...packageInput, p_customer_id: 2, p_actor_id: otherId }), error => error.message === 'ownership_forbidden')
  await assert.rejects(createSql(db, { ...packageInput, p_service_id: 2 }), error => error.message === 'package_not_usable')
  await db.exec("update public.customer_packages set expires_at=now()+interval '1 day'")
  await assert.rejects(createSql(db, packageInput), error => error.message === 'package_not_usable')
  await db.exec("update public.customer_packages set expires_at=now()+interval '100 days', sessions_remaining=1")
  const booked = await createSql(db, packageInput)
  assert.equal(booked.customer_package_id, 1)
  assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 0)
  assert.equal((await db.query('select appointment_id from public.package_redemptions')).rows[0].appointment_id, booked.id)
  await assert.rejects(createSql(db, { ...packageInput, p_starts_at: await futureSlot(db, 4) }), error => error.message === 'package_not_usable')
  assert.equal((await db.query('select count(*)::int as count from public.appointments')).rows[0].count, 1)
})

test('redemption write failure rolls back appointment and balance, collision never consumes a session', async t => {
  const db = await bookingDatabase(t)
  await db.exec(`create function public.reject_redemption() returns trigger language plpgsql as $$ begin raise exception 'test_write_failure'; end $$;
    create trigger test_redemption_failure before insert on public.package_redemptions for each row execute function public.reject_redemption();`)
  await assert.rejects(createSql(db, packageInput), /test_write_failure/)
  assert.equal((await db.query('select count(*)::int as count from public.appointments')).rows[0].count, 0)
  assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 2)
  await db.exec('drop trigger test_redemption_failure on public.package_redemptions')
  await createSql(db, { p_staff_preference: '1' })
  await assert.rejects(createSql(db, { ...packageInput, p_staff_preference: '1' }), error => error.message === 'slot_unavailable')
  assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 2)
})

test('reschedule preserves old occupancy and redemption on collision and moves once on success', async t => {
  const db = await bookingDatabase(t)
  const original = await createSql(db, { ...packageInput, p_staff_preference: '1' })
  const target = await futureSlot(db, 4)
  await createSql(db, { p_staff_preference: '1', p_starts_at: target })
  const input = { p_appointment_id: original.id, p_starts_at: target, p_staff_preference: '1', p_actor_id: ownerId }
  await assert.rejects(callSql(db, 'reschedule_appointment_v2', input), error => error.message === 'slot_unavailable')
  assert.deepEqual((await db.query('select * from public.appointments where id=$1', [original.id])).rows[0], original)
  const moved = await callSql(db, 'reschedule_appointment_v2', { ...input, p_staff_preference: 'any' })
  assert.equal(moved.id, original.id)
  assert.equal(moved.reference, original.reference)
  assert.equal(moved.staff_id, 2)
  assert.equal(moved.starts_at.toISOString(), target)
  assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 1)
  assert.equal((await db.query('select count(*)::int as count from public.package_redemptions')).rows[0].count, 1)
})

test('cancel refunds once with a retained audit record and enforces ownership/status/cutoff', async t => {
  const db = await bookingDatabase(t)
  const original = await createSql(db, packageInput)
  const input = { p_appointment_id: original.id, p_actor_id: ownerId }
  await assert.rejects(callSql(db, 'cancel_appointment_v2', { ...input, p_actor_id: otherId }), error => error.message === 'ownership_forbidden')
  await db.exec("update public.app_settings set data=data || '{\"cancel_cutoff_hours\":100}'")
  await assert.rejects(callSql(db, 'cancel_appointment_v2', input), error => error.message === 'late_cancellation')
  await db.exec("update public.app_settings set data=data || '{\"cancel_cutoff_hours\":24}'")
  const once = await callSql(db, 'cancel_appointment_v2', input)
  const twice = await callSql(db, 'cancel_appointment_v2', input)
  assert.equal(once.status, 'cancelled')
  assert.equal(once.cancelled_by, ownerId)
  assert.deepEqual(twice, once)
  assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 2)
  assert.ok((await db.query('select refunded_at from public.package_redemptions')).rows[0].refunded_at)
  // A stale legacy refund must not refund a previously refunded redemption,
  // even after a subsequent real booking creates room below the package cap.
  await createSql(db, { ...packageInput, p_starts_at: await futureSlot(db, 6) })
  await db.query('select public.refund_customer_package(1,$1)', [original.id])
  assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 1)
  assert.equal((await db.query('select count(*)::int as count from public.package_redemptions')).rows[0].count, 2)
  await assert.rejects(callSql(db, 'reschedule_appointment_v2', { ...input, p_starts_at: await futureSlot(db, 5), p_staff_preference: 'any' }), error => error.message === 'booking_not_changeable')
})

test('only service_role can execute commands and its explicit privileges suffice for real SQL', async t => {
  const db = await bookingDatabase(t)
  const start = await futureSlot(db)
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    try { await assert.rejects(createSql(db, { p_starts_at: start }), error => error.code === '42501') }
    finally { await db.exec('reset role') }
  }
  await db.exec('set role service_role')
  try {
    const booked = await createSql(db, { ...packageInput, p_starts_at: start })
    const moved = await callSql(db, 'reschedule_appointment_v2', { p_appointment_id: booked.id,
      p_starts_at: await futureSlot(db, 4), p_staff_preference: '2', p_actor_id: ownerId })
    assert.equal(moved.staff_id, 2)
    const cancelled = await callSql(db, 'cancel_appointment_v2', { p_appointment_id: booked.id, p_actor_id: ownerId })
    assert.equal(cancelled.status, 'cancelled')
  } finally { await db.exec('reset role') }
})

for (const legacyFunctionGrants of [false, true]) {
  test(`every booking mutation signature denies browser execution (legacy function grants=${legacyFunctionGrants})`, async t => {
    const db = await bookingDatabase(t, { legacyFunctionGrants })
    const start = await futureSlot(db, 10)
    const original = await createSql(db, packageInput)
    const probes = [
      ['create_salon_appointment', `select * from public.create_salon_appointment(1,$1::uuid,'Probe Customer','91234567',null,$2::timestamptz,'probe')`, [otherId,start]],
      ['create_salon_appointment_with_package', `select * from public.create_salon_appointment_with_package($1::uuid,2,1,1,'Forged Customer','91234567',null,$2::timestamptz,'forged admin notes')`, [otherId,start]],
      ['deduct_package_session', 'select public.deduct_package_session(1,$1)', [original.id]],
      ['redeem_customer_package', 'select public.redeem_customer_package(1,$1)', [original.id]],
      ['refund_customer_package', 'select public.refund_customer_package(1,$1)', [original.id]],
      ['create_appointment_v2', `select * from public.create_appointment_v2(1,$1::timestamptz,'any','Probe Customer','91234567',null,null,null,null,'web',repeat('a',64),null)`, [start]],
      ['reschedule_appointment_v2', `select * from public.reschedule_appointment_v2($1,$2::timestamptz,'any',$3::uuid)`, [original.id,start,ownerId]],
      ['cancel_appointment_v2', 'select * from public.cancel_appointment_v2($1,$2::uuid)', [original.id,ownerId]],
    ]
    // Enumerate the actual installed signatures, not migration source text.
    const catalog = (await db.query(`select p.proname, p.oid::regprocedure::text as signature,
      has_function_privilege('service_role',p.oid,'execute') as service_allowed
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=any($1::text[]) order by p.proname`, [probes.map(([name]) => name)])).rows
    assert.deepEqual(catalog.map(row => row.proname).sort(), probes.map(([name]) => name).sort())
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`)
      try {
        for (const [name, sql, params] of probes) {
          await assert.rejects(db.query(sql, params), error => error.code === '42501', `${role} must not execute ${name}`)
        }
      } finally { await db.exec('reset role') }
    }
    assert.equal(catalog.every(row => row.service_allowed), true)
    assert.equal((await db.query('select count(*)::int as count from public.appointments')).rows[0].count, 1)
    assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 1)
    assert.equal((await db.query('select count(*)::int as count from public.package_redemptions')).rows[0].count, 1)
    await db.exec('set role service_role')
    try {
      const legacy = (await db.query(probes[0][1], probes[0][2])).rows[0]
      assert.ok(legacy.id)
      const packaged = (await db.query(`select * from public.create_salon_appointment_with_package($1::uuid,1,1,null,
        'Legacy Customer','91234567',null,$2::timestamptz,'')`, [ownerId,await futureSlot(db,11)])).rows[0]
      const redemption = (await db.query('select * from public.deduct_package_session(1,$1)', [packaged.id])).rows[0]
      assert.equal(redemption.appointment_id, packaged.id)
      await db.query('select public.refund_customer_package(1,$1)', [packaged.id])
      assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 1)
    } finally { await db.exec('reset role') }
  })
}

test('failed cancellation status write rolls back its package refund and retains the old occupied slot', async t => {
  const db = await bookingDatabase(t)
  const original = await createSql(db, { ...packageInput, p_staff_preference: '1' })
  await db.exec(`create function public.reject_cancellation() returns trigger language plpgsql as $$
    begin if new.status='cancelled' then raise exception 'test_cancel_write_failure'; end if; return new; end $$;
    create trigger test_cancel_failure before update on public.appointments for each row execute function public.reject_cancellation();`)
  await assert.rejects(callSql(db, 'cancel_appointment_v2', { p_appointment_id: original.id, p_actor_id: ownerId }), /test_cancel_write_failure/)
  assert.deepEqual((await db.query('select * from public.appointments where id=$1', [original.id])).rows[0], original)
  assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 1)
  assert.equal((await db.query('select refunded_at from public.package_redemptions')).rows[0].refunded_at, null)
  await assert.rejects(createSql(db, { p_staff_preference: '1' }), error => error.message === 'slot_unavailable')
})

test('parallel route submissions consume the last package session once and leave no orphan booking', async t => {
  // PGlite queues statements in one backend: this verifies command/transport
  // atomicity under Promise fan-out, not PostgreSQL multi-session lock timing.
  const db = await bookingDatabase(t)
  await db.exec('update public.customer_packages set sessions_remaining=1')
  const { createAppointmentsHandler } = await import('../app/api/appointments/route.js')
  const handler = createAppointmentsHandler({ getServiceClient: () => rpcClient(db), notify: async () => {},
    resolveCustomer: async () => ({ customer: { id:1, user_id:ownerId, name:'Owner', phone:'91234567' }, actorUserId:ownerId }) })
  const body = { serviceId:1, startsAt:await futureSlot(db), customerPackageId:1, customerId:2 }
  const responses = await Promise.all([handler(request(body)), handler(request({ ...body, startsAt:await futureSlot(db, 4) }))])
  assert.deepEqual(responses.map(response => response.status).sort(), [201,400])
  assert.equal((await db.query('select count(*)::int as count from public.appointments')).rows[0].count, 1)
  assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 0)
  assert.equal((await db.query('select count(*)::int as count from public.package_redemptions')).rows[0].count, 1)
})

test('wrapper stores only SHA-256 of a random 32-byte confirmation token and sanitizes errors/appointment', async t => {
  const db = await bookingDatabase(t)
  const { createAppointment, rescheduleAppointment, cancelAppointment } = await import('../lib/booking/commands.js')
  const client = rpcClient(db)
  const input = { serviceId: 1, startsAt: await futureSlot(db), staffPreference: 1, customer: { name: 'Guest Customer', phone: '91234567' } }
  const result = await createAppointment(client, input)
  assert.equal(Buffer.from(result.confirmationToken, 'base64url').length, 32)
  assert.equal(result.appointment.confirmation_token_hash, undefined)
  assert.equal(result.appointment.admin_notes, undefined)
  const stored = (await db.query('select confirmation_token_hash from public.appointments where id=$1', [result.appointment.id])).rows[0]
  assert.equal(stored.confirmation_token_hash, createHash('sha256').update(result.confirmationToken).digest('hex'))
  await assert.rejects(createAppointment(client, input), error => error.code === 'slot_unavailable' && error.status === 409)
  await assert.rejects(createAppointment(client, { ...input, customerPackageId: 1 }), error => error.code === 'authentication_required' && error.status === 401)
  const authenticated = await createAppointment(client, { ...input, startsAt: await futureSlot(db, 4), customer: { id: 1, user_id: ownerId, name: 'Owner', phone: '91234567' }, actorUserId: ownerId, customerPackageId: 1, source: 'account' })
  const moved = await rescheduleAppointment(client, { appointmentId: authenticated.appointment.id, startsAt: await futureSlot(db, 5), actorUserId: ownerId })
  assert.equal(moved.id, authenticated.appointment.id)
  const cancelled = await cancelAppointment(client, { appointmentId: moved.id, actorUserId: ownerId })
  assert.equal(cancelled.status, 'cancelled')
  await assert.rejects(createAppointment({ rpc: async () => ({ error: { code: 'XX000', message: 'secret PostgreSQL details' } }) }, input), error => error.code === 'internal_error' && !error.message.includes('secret'))
})

test('wrapper rejects impossible calendar dates before they can be normalized into a different booking day', async () => {
  const { createAppointment } = await import('../lib/booking/commands.js')
  const db = { rpc: async () => { throw new Error('must not reach the database') } }
  for (const startsAt of ['2027-02-30T10:00:00+08:00', '2027-04-31T10:00:00+08:00', '2027-02-28T24:00:00+08:00']) {
    await assert.rejects(createAppointment(db, { serviceId:1, startsAt, customer:{name:'Test Guest',phone:'91234567'} }),
      error => error.code === 'validation_error')
  }
})

let requestNumber = 0
function request(body, method = 'POST') {
  return new Request('http://localhost/api/appointments', { method,
    headers: { 'content-type': 'application/json', origin: 'http://localhost', 'x-real-ip': `commands-test-${++requestNumber}` },
    ...(method === 'DELETE' ? {} : { body: JSON.stringify(body) }),
  })
}

test('create route calls the atomic command, ignores browser identity, and returns safe 400/401/409/500 responses', async t => {
  const db = await bookingDatabase(t)
  const { createAppointmentsHandler } = await import('../app/api/appointments/route.js')
  assert.equal(typeof createAppointmentsHandler, 'function')
  const handler = createAppointmentsHandler({ getServiceClient: () => rpcClient(db), notify: async () => {}, resolveCustomer: async () => null })
  const body = { serviceId: 1, staffPreference: 1, startsAt: await futureSlot(db), customerName: 'Route Guest', customerPhone: '91234567', customerId: 2, actorUserId: otherId, source: 'admin' }
  const result = await handler(request(body))
  assert.equal(result.status, 201)
  const payload = await result.json()
  assert.ok(payload.confirmationToken)
  assert.equal(payload.appointment.customer_id, null)
  assert.equal(payload.appointment.user_id, null)
  assert.equal(payload.appointment.source, 'web')
  assert.equal(payload.appointment.confirmation_token_hash, undefined)
  assert.equal((await handler(request(body))).status, 409)
  assert.equal((await handler(request({ ...body, customerPackageId: 1 }))).status, 401)
  assert.equal((await handler(request({ ...body, startsAt: 'invalid' }))).status, 400)
  assert.equal((await handler(new Request('http://localhost/api/appointments', { method:'POST', headers:{origin:'http://localhost'}, body:'{' }))).status, 400)
  const failing = createAppointmentsHandler({ getServiceClient: () => ({ rpc: async () => ({ error: { code: 'XX000', message: 'private database details' } }) }), notify: async () => {}, resolveCustomer: async () => null })
  const failure = await failing(request(body))
  assert.equal(failure.status, 500)
  assert.equal((await failure.json()).code, 'internal_error')
})

test('account routes execute atomic reschedule/cancel with the verified actor and reject another owner', async t => {
  const db = await bookingDatabase(t)
  const { createAccountBookingHandlers } = await import('../app/api/account/bookings/[id]/route.js')
  assert.equal(typeof createAccountBookingHandlers, 'function')
  const original = await createSql(db, packageInput)
  const handlers = (actor) => createAccountBookingHandlers({ getServiceClient: () => rpcClient(db),
    getServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: actor ? { id: actor } : null } }) } }), notify: async () => {} })
  const params = { params: Promise.resolve({ id: String(original.id) }) }
  const body = { startsAt: await futureSlot(db, 4), staffPreference: 2, actorUserId: otherId }
  assert.equal((await handlers(null).PATCH(request(body, 'PATCH'), params)).status, 401)
  assert.equal((await handlers(otherId).PATCH(request(body, 'PATCH'), params)).status, 403)
  const moved = await handlers(ownerId).PATCH(request(body, 'PATCH'), params)
  assert.equal(moved.status, 200)
  assert.equal((await moved.json()).booking.staff_id, 2)
  assert.equal((await handlers(otherId).DELETE(request(null, 'DELETE'), params)).status, 403)
  await db.exec("update public.app_settings set data=data || '{\"cancel_cutoff_hours\":150}'")
  const late = await handlers(ownerId).DELETE(request(null, 'DELETE'), params)
  assert.equal(late.status, 400)
  const latePayload = await late.json()
  assert.equal(latePayload.cutoffHours, 150)
  assert.equal(typeof latePayload.hoursUntilStart, 'number')
  assert.equal(latePayload.details, undefined)
  await db.exec("update public.app_settings set data=data || '{\"cancel_cutoff_hours\":24}'")
  assert.equal((await handlers(ownerId).DELETE(request(null, 'DELETE'), params)).status, 200)
  assert.equal((await handlers(ownerId).DELETE(request(null, 'DELETE'), params)).status, 200)
  assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 2)
})

test('account PATCH validates the original date and time before conversion and keeps invalid requests unchanged', async t => {
  const db = await bookingDatabase(t)
  const { createAccountBookingHandlers } = await import('../app/api/account/bookings/[id]/route.js')
  const original = await createSql(db, packageInput)
  const target = await futureSlot(db, 4)
  const validDate = new Date(target).toLocaleDateString('sv-SE', { timeZone:'Asia/Hong_Kong' })
  const handlers = createAccountBookingHandlers({ getServiceClient: () => rpcClient(db), notify: async () => {},
    getServerClient: async () => ({ auth:{getUser: async () => ({data:{user:{id:ownerId}}})} }) })
  const context = { params:Promise.resolve({id:String(original.id)}) }
  const invalid = [
    {date:'2026-09-31',time:'10:00'}, {date:'2027-02-29',time:'10:00'},
    {date:'2026-13-01',time:'10:00'}, {date:validDate,time:'24:00'},
    {date:validDate,time:'24:30'}, {date:validDate,time:'10:60'},
    {date:validDate,time:'23:90'}, {date:validDate,time:'1:00'},
    {date:` ${validDate}`,time:'10:00'}, {date:`${validDate} `,time:'10:00'},
    {date:validDate,time:' 10:00'}, {date:validDate,time:'10:00 '},
    {date:validDate,time:'10:00:00'}, {date:validDate,time:'10:00extra'},
    {date:[validDate],time:'10:00'}, {date:validDate,time:['10:00']},
  ]
  for (const body of invalid) {
    const response = await handlers.PATCH(request(body,'PATCH'), context)
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.equal((await response.json()).code, 'validation_error', JSON.stringify(body))
    assert.deepEqual((await db.query('select * from public.appointments where id=$1',[original.id])).rows[0], original)
    assert.equal((await db.query('select sessions_remaining from public.customer_packages')).rows[0].sessions_remaining, 1)
    assert.equal((await db.query('select count(*)::int as count from public.package_redemptions where refunded_at is null')).rows[0].count, 1)
  }
  const valid = await handlers.PATCH(request({date:validDate,time:'10:00'},'PATCH'), context)
  assert.equal(valid.status, 200)
  assert.equal((await valid.json()).booking.starts_at, target)
})
