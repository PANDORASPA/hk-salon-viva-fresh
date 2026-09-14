import assert from 'node:assert/strict'
import test from 'node:test'
import { bookingDatabase, callSql, rpcClient, adminId, otherId, futureSlot } from './helpers/booking-database.mjs'

const staffInput = {
  name: '  Amy Chan  ',
  displayName: '  Amy  ',
  bio: 'Senior stylist',
  colourHex: '#A1B2C3',
  isActive: true,
  sortOrder: 3,
  serviceIds: [1, 2],
}

test('staff validator accepts the explicit display payload and rejects dangerous schedules', async () => {
  // Mutation caught: accepting short names, non-hex colours, duplicate/non-positive
  // service ids, malformed clock values, or a backwards time-off interval.
  const { validateStaffInput, validateWeeklyHours, validateTimeOffInput } = await import('../lib/validation/staff.js')
  assert.deepEqual(validateStaffInput(staffInput), {
    ok: true,
    value: {
      name: 'Amy Chan', displayName: 'Amy', bio: 'Senior stylist', colourHex: '#a1b2c3',
      isActive: true, sortOrder: 3, serviceIds: [1, 2],
    },
  })
  for (const input of [
    { ...staffInput, name: 'A' },
    { ...staffInput, colourHex: 'a1b2c3' },
    { ...staffInput, serviceIds: [1, 1] },
    { ...staffInput, serviceIds: [0] },
    { ...staffInput, unexpected: true },
  ]) assert.equal(validateStaffInput(input).ok, false)

  const hours = Array.from({ length: 7 }, (_, weekday) => ({
    weekday, isWorking: weekday !== 0, startsAt: weekday === 0 ? null : '10:00', endsAt: weekday === 0 ? null : '18:00',
  }))
  assert.deepEqual(validateWeeklyHours(hours), { ok: true, value: hours })
  for (const broken of [
    hours.slice(0, 6),
    [{ ...hours[0], weekday: 1 }, ...hours.slice(1)],
    hours.map(row => row.weekday === 1 ? { ...row, startsAt: '18:00', endsAt: '10:00' } : row),
    hours.map(row => row.weekday === 1 ? { ...row, startsAt: '9:00' } : row),
  ]) assert.equal(validateWeeklyHours(broken).ok, false)

  assert.deepEqual(validateTimeOffInput({ startsAt: '2027-02-28T10:00:00+08:00', endsAt: '2027-02-28T12:00:00+08:00', reason: 'Leave' }), {
    ok: true, value: { startsAt: '2027-02-28T02:00:00.000Z', endsAt: '2027-02-28T04:00:00.000Z', reason: 'Leave' },
  })
  for (const input of [
    { startsAt: '2027-02-30T10:00:00+08:00', endsAt: '2027-03-01T10:00:00+08:00' },
    { startsAt: '2027-02-28T12:00:00+08:00', endsAt: '2027-02-28T10:00:00+08:00' },
  ]) assert.equal(validateTimeOffInput(input).ok, false)
})

test('staff commands replace mappings and all seven weekly rows atomically', async t => {
  // Mutation caught: a partial relationship/rota replacement after a failed
  // write, or an update that leaves removed service mappings in place.
  const db = await bookingDatabase(t)
  const created = await callSql(db, 'admin_create_staff', {
    p_name: 'Amy Chan', p_display_name: 'Amy', p_bio: null, p_colour_hex: '#a1b2c3',
    p_is_active: true, p_sort_order: 3, p_service_ids: [1, 2],
  })
  assert.deepEqual((await db.query('select service_id from public.staff_services where staff_id=$1 order by service_id', [created.id])).rows,
    [{ service_id: 1 }, { service_id: 2 }])
  await callSql(db, 'admin_update_staff', {
    p_staff_id: created.id, p_name: 'Amy Chan', p_display_name: 'Amy C', p_bio: 'Updated',
    p_colour_hex: '#112233', p_is_active: true, p_sort_order: 4, p_service_ids: [2],
  })
  assert.deepEqual((await db.query('select service_id from public.staff_services where staff_id=$1', [created.id])).rows, [{ service_id: 2 }])

  const validHours = Array.from({ length: 7 }, (_, weekday) => ({ weekday, isWorking: true, startsAt: '10:00', endsAt: '18:00' }))
  await callSql(db, 'admin_replace_staff_weekly_hours', { p_staff_id: created.id, p_hours: JSON.stringify(validHours) })
  assert.equal((await db.query('select count(*)::int as count from public.staff_weekly_hours where staff_id=$1', [created.id])).rows[0].count, 7)
  await assert.rejects(callSql(db, 'admin_replace_staff_weekly_hours', {
    p_staff_id: created.id,
    p_hours: JSON.stringify(validHours.map(row => row.weekday === 3 ? { ...row, startsAt: '18:00', endsAt: '10:00' } : row)),
  }), /invalid_staff_weekly_hours/)
  assert.deepEqual((await db.query('select weekday, starts_at::text, ends_at::text from public.staff_weekly_hours where staff_id=$1 order by weekday', [created.id])).rows,
    Array.from({ length: 7 }, (_, weekday) => ({ weekday, starts_at: '10:00:00', ends_at: '18:00:00' })))
})

test('staff command rejects deactivation with a future active appointment and browser roles cannot invoke it', async t => {
  // Mutation caught: silently making an assigned future appointment unavailable,
  // or exposing a privileged staff mutation RPC to a browser role.
  const db = await bookingDatabase(t)
  const startsAt = await futureSlot(db, 5)
  await callSql(db, 'create_appointment_v2', {
    p_service_id: 1, p_starts_at: startsAt, p_staff_preference: '1', p_customer_name: 'Guest Customer',
    p_customer_phone: '91234567', p_customer_email: null, p_customer_id: null, p_actor_id: null,
    p_customer_package_id: null, p_source: 'web', p_confirmation_token_hash: 'a'.repeat(64), p_customer_notes: null,
  })
  await assert.rejects(callSql(db, 'admin_update_staff', {
    p_staff_id: 1, p_name: '預設員工', p_display_name: 'SALON POKE 團隊', p_bio: null,
    p_colour_hex: '#a98152', p_is_active: false, p_sort_order: 0, p_service_ids: [1, 2],
  }), /staff_has_future_appointments/)
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    try {
      await assert.rejects(callSql(db, 'admin_create_staff', {
        p_name: 'Browser Staff', p_display_name: 'Browser', p_bio: null, p_colour_hex: '#112233',
        p_is_active: true, p_sort_order: 0, p_service_ids: [1],
      }), error => error.code === '42501')
    } finally { await db.exec('reset role') }
  }
  await db.exec('set role service_role')
  try {
    await assert.rejects(callSql(db, 'admin_create_staff', {
      p_name: 'Server Staff', p_display_name: 'Server', p_bio: null, p_colour_hex: '#112233',
      p_is_active: true, p_sort_order: 0, p_service_ids: [1],
    }), error => error.code === '42501')
    const serverCreated = await callSql(db, 'admin_create_staff_audited', {
      p_actor_id: adminId, p_name: 'Server Staff', p_display_name: 'Server', p_bio: null, p_colour_hex: '#112233',
      p_is_active: true, p_sort_order: 0, p_service_ids: [1],
    })
    assert.equal(serverCreated.display_name, 'Server')
  } finally { await db.exec('reset role') }
})

test('admin route factories guard mutation, require admin context, persist an audit, and use allowlisted RPC input', async t => {
  // Mutation caught: reaching the database before CSRF/origin protection,
  // accepting browser-only fields, skipping the active-admin check, or failing
  // to leave an auditable create record.
  const db = await bookingDatabase(t)
  const { createStaffHandlers } = await import('../app/api/admin/staff/route.js')
  let contextCalls = 0
  const guarded = createStaffHandlers({
    guardMutationRequest: async () => new Response(JSON.stringify({ error: 'blocked' }), { status: 403 }),
    adminContext: async () => { contextCalls += 1; return { db: rpcClient(db), auth: { user: { id: adminId } } } },
  })
  const request = body => new Request('http://localhost/api/admin/staff', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await guarded.POST(request(staffInput))).status, 403)
  assert.equal(contextCalls, 0)

  const denied = createStaffHandlers({
    guardMutationRequest: async () => null,
    adminContext: async () => ({ response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) }),
  })
  assert.equal((await denied.POST(request(staffInput))).status, 403)

  const handler = createStaffHandlers({
    guardMutationRequest: async () => null,
    adminContext: async () => ({ db: rpcClient(db), auth: { user: { id: adminId } } }),
    revalidatePath() {},
  })
  const created = await handler.POST(request({ ...staffInput, ignoredByServer: 'nope' }))
  assert.equal(created.status, 400)
  const success = await handler.POST(request(staffInput))
  assert.equal(success.status, 201)
  const payload = await success.json()
  assert.equal(payload.staff.displayName, 'Amy')
  assert.deepEqual((await db.query(`select actor_id, action, target_table, target_id from public.admin_audit_logs
    where action='staff.create' and target_id=$1`, [String(payload.staff.id)])).rows, [{
    actor_id: adminId, action: 'staff.create', target_table: 'staff', target_id: String(payload.staff.id),
  }])
})

test('detail, hours, and time-off route factories use the atomic commands with guarded audited mutations', async t => {
  // Mutation caught: a route that writes a schedule/time-off directly, accepts
  // an invalid interval, or mutates without the standard guard and audit path.
  const db = await bookingDatabase(t)
  const person = (await db.query('select * from public.staff where id=2')).rows[0]
  const context = async () => ({ db: rpcClient(db), auth: { user: { id: adminId } } })
  const dependencies = {
    adminContext: context, guardMutationRequest: async () => null,
    loadStaff: async () => ({ ...person, serviceIds: [1] }), revalidatePath() {},
  }
  const params = { params: Promise.resolve({ id: '2' }) }
  const request = (url, method, body) => new Request(url, {
    method, headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: body == null ? undefined : JSON.stringify(body),
  })
  const { createStaffDetailHandlers } = await import('../app/api/admin/staff/[id]/route.js')
  const detail = createStaffDetailHandlers(dependencies)
  const updated = await detail.PATCH(request('http://localhost/api/admin/staff/2', 'PATCH', {
    name: 'Staff B', displayName: 'B updated', bio: null, colourHex: '#112233', isActive: true, sortOrder: 2, serviceIds: [2],
  }), params)
  assert.equal(updated.status, 200)
  assert.deepEqual((await db.query('select service_id from public.staff_services where staff_id=2')).rows, [{ service_id: 2 }])

  const { createStaffHoursHandlers } = await import('../app/api/admin/staff/[id]/hours/route.js')
  const hours = createStaffHoursHandlers(dependencies)
  const replacement = Array.from({ length: 7 }, (_, weekday) => ({ weekday, isWorking: weekday !== 0, startsAt: weekday === 0 ? null : '11:00', endsAt: weekday === 0 ? null : '17:00' }))
  assert.equal((await hours.PUT(request('http://localhost/api/admin/staff/2/hours', 'PUT', { hours: replacement }), params)).status, 200)
  assert.equal((await db.query("select starts_at::text from public.staff_weekly_hours where staff_id=2 and weekday=1")).rows[0].starts_at, '11:00:00')
  assert.equal((await hours.PUT(request('http://localhost/api/admin/staff/2/hours', 'PUT', { hours: replacement.slice(1) }), params)).status, 400)

  const { createStaffTimeOffHandlers } = await import('../app/api/admin/staff/[id]/time-off/route.js')
  const timeOff = createStaffTimeOffHandlers(dependencies)
  const created = await timeOff.POST(request('http://localhost/api/admin/staff/2/time-off', 'POST', {
    startsAt: '2027-02-28T10:00:00+08:00', endsAt: '2027-02-28T12:00:00+08:00', reason: 'Training',
  }), params)
  assert.equal(created.status, 201)
  const timeOffId = (await created.json()).timeOff.id
  assert.equal((await timeOff.DELETE(request(`http://localhost/api/admin/staff/2/time-off?id=${timeOffId}`, 'DELETE'), params)).status, 200)
  assert.equal((await db.query('select count(*)::int as count from public.staff_time_off where id=$1', [timeOffId])).rows[0].count, 0)
  assert.deepEqual((await db.query(`select action from public.admin_audit_logs where action=any($1::text[]) order by id`,
    [['staff.update', 'staff.hours.replace', 'staff.time_off.create', 'staff.time_off.delete']])).rows,
    [{ action: 'staff.update' }, { action: 'staff.hours.replace' }, { action: 'staff.time_off.create' }, { action: 'staff.time_off.delete' }])
})

test('audited staff command commits its audit row or rolls the staff mutation back', async t => {
  // Mutation caught: reporting a staff write as successful after its separate
  // audit insert fails, leaving an unauditable state change behind.
  const db = await bookingDatabase(t)
  const input = {
    p_actor_id: adminId, p_name: 'Audited Staff', p_display_name: 'Audited', p_bio: null,
    p_colour_hex: '#112233', p_is_active: true, p_sort_order: 9, p_service_ids: [1],
  }
  const created = await callSql(db, 'admin_create_staff_audited', input)
  assert.equal(created.display_name, 'Audited')
  assert.deepEqual((await db.query(`select actor_id, action, entity_type, target_table, target_id
    from public.admin_audit_logs where action='staff.create' order by id desc limit 1`)).rows, [{
    actor_id: adminId, action: 'staff.create', entity_type: 'staff', target_table: 'staff', target_id: String(created.id),
  }])
  const before = (await db.query('select count(*)::int as count from public.staff')).rows[0].count
  await db.exec(`create function public.reject_staff_audit() returns trigger language plpgsql as $$
    begin if new.action='staff.create' then raise exception 'audit_insert_failed'; end if; return new; end $$;
    create trigger reject_staff_audit before insert on public.admin_audit_logs for each row execute function public.reject_staff_audit();`)
  await assert.rejects(callSql(db, 'admin_create_staff_audited', { ...input, p_name: 'Must Roll Back', p_display_name: 'Rollback' }), /audit_insert_failed/)
  assert.equal((await db.query('select count(*)::int as count from public.staff')).rows[0].count, before)
  await db.exec('drop trigger reject_staff_audit on public.admin_audit_logs')
  await assert.rejects(callSql(db, 'admin_create_staff_audited', { ...input, p_actor_id: otherId, p_name: 'Forged Actor', p_display_name: 'Forged' }),
    error => error.message === 'admin_forbidden')
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    try { await assert.rejects(callSql(db, 'admin_create_staff_audited', input), error => error.code === '42501') }
    finally { await db.exec('reset role') }
  }
  await db.exec('set role service_role')
  try { assert.ok((await callSql(db, 'admin_create_staff_audited', { ...input, p_name: 'Server Audited', p_display_name: 'Server Audited' })).id) }
  finally { await db.exec('reset role') }
})

test('staff create route reports success only after the database records its audit', async t => {
  // Mutation caught: restoring a route-level best-effort audit call after the
  // command already committed its staff mutation.
  const db = await bookingDatabase(t)
  const { createStaffHandlers } = await import('../app/api/admin/staff/route.js')
  const handler = createStaffHandlers({
    guardMutationRequest: async () => null,
    adminContext: async () => ({ db: rpcClient(db), auth: { user: { id: adminId } } }),
    revalidatePath() {},
  })
  const response = await handler.POST(new Request('http://localhost/api/admin/staff', {
    method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(staffInput),
  }))
  assert.equal(response.status, 201)
  const staff = (await response.json()).staff
  assert.deepEqual((await db.query(`select action, target_id from public.admin_audit_logs
    where action='staff.create' and target_id=$1`, [String(staff.id)])).rows, [{ action: 'staff.create', target_id: String(staff.id) }])
})

for (const legacyInsertGrant of [false, true]) {
  test(`browser roles cannot forge an admin audit row even with a legacy INSERT grant=${legacyInsertGrant}`, async t => {
    // Mutation caught: a browser client posing as an admin and inserting a
    // forged staff action/metadata directly into the audit table.
    const db = await bookingDatabase(t)
    if (legacyInsertGrant) await db.exec('grant insert on public.admin_audit_logs to authenticated')
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [adminId])
    await db.exec('set role authenticated')
    try {
      await assert.rejects(db.query(`insert into public.admin_audit_logs
        (actor_id,actor_user_id,action,entity_type,target_table,target_id,metadata)
        values ($1,$1,'staff.delete','staff','staff','1','{"forged":true}'::jsonb)`, [adminId]),
      error => error.code === '42501')
      assert.equal((await db.query(`select count(*)::int as count from public.admin_audit_logs
        where action='staff.delete'`)).rows[0].count, 0)
    } finally { await db.exec('reset role') }

    await db.exec('set role service_role')
    let created
    try {
      created = await callSql(db, 'admin_create_staff_audited', {
        p_actor_id: adminId, p_name: 'Secure Audit Staff', p_display_name: 'Secure', p_bio: null,
        p_colour_hex: '#112233', p_is_active: true, p_sort_order: 8, p_service_ids: [1],
      })
    } finally { await db.exec('reset role') }
    await db.exec('set role authenticated')
    try {
      assert.deepEqual((await db.query(`select actor_id, action, target_id from public.admin_audit_logs
        where target_id=$1`, [String(created.id)])).rows, [{ actor_id: adminId, action: 'staff.create', target_id: String(created.id) }])
    } finally { await db.exec('reset role') }
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [otherId])
    await db.exec('set role authenticated')
    try {
      assert.deepEqual((await db.query('select id from public.admin_audit_logs where target_id=$1', [String(created.id)])).rows, [])
    } finally { await db.exec('reset role') }
  })
}
