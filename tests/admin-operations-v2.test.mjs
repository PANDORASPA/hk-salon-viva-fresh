import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { adminId, bookingDatabase, callSql, createSql, futureSlot, rpcClient } from './helpers/booking-database.mjs'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const request = (body, method = 'POST') => new Request('http://localhost/api/admin/appointments', {
  method,
  headers: { origin: 'http://localhost', 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

test('admin appointment route creates and reschedules through the booking commands using the verified admin actor', async t => {
  // Mutation caught: trusting actorUserId from the browser or replacing either
  // scheduling operation with a direct appointments write.
  const db = await bookingDatabase(t)
  const { createAdminAppointmentsHandlers } = await import('../app/api/admin/appointments/route.js')
  const handlers = createAdminAppointmentsHandlers({
    adminContext: async () => ({ db: rpcClient(db), auth: { user: { id: adminId } } }),
    guardMutationRequest: async () => null,
    audit: async () => {},
    notify: async () => {},
  })
  const created = await handlers.POST(request({
    serviceId: 1, startsAt: await futureSlot(db), staffPreference: 1,
    customerName: 'Admin Guest', customerPhone: '91234567', actorUserId: '00000000-0000-0000-0000-000000000012',
  }))
  assert.equal(created.status, 201)
  const booking = (await created.json()).appointment
  assert.equal(booking.source, 'admin')
  assert.equal(booking.user_id, null)

  const rescheduled = await handlers.PATCH(request({
    id: booking.id, startsAt: await futureSlot(db, 4), staffPreference: 2, actorUserId: '00000000-0000-0000-0000-000000000012',
  }, 'PATCH'))
  assert.equal(rescheduled.status, 200)
  assert.equal((await rescheduled.json()).appointment.staff_id, 2)
  assert.equal((await db.query('select source, staff_id from public.appointments where id=$1', [booking.id])).rows[0].source, 'admin')
})

test('admin appointment route preserves the atomic command when a scheduling conflict is rejected', async t => {
  // Mutation caught: a direct update that moves the appointment despite the
  // occupied range conflict that the command would reject.
  const db = await bookingDatabase(t)
  const original = await createSql(db, { p_staff_preference: '1' })
  const target = await futureSlot(db, 4)
  await createSql(db, { p_staff_preference: '1', p_starts_at: target })
  const { createAdminAppointmentsHandlers } = await import('../app/api/admin/appointments/route.js')
  const handlers = createAdminAppointmentsHandlers({
    adminContext: async () => ({ db: rpcClient(db), auth: { user: { id: adminId } } }),
    guardMutationRequest: async () => null,
    audit: async () => {},
    notify: async () => {},
  })
  const response = await handlers.PATCH(request({ id: original.id, startsAt: target, staffPreference: 1 }, 'PATCH'))
  assert.equal(response.status, 409)
  assert.deepEqual((await db.query('select starts_at, staff_id from public.appointments where id=$1', [original.id])).rows[0], {
    starts_at: original.starts_at, staff_id: 1,
  })
})

test('admin booking response exposes a notification persistence warning after the atomic command succeeds', async t => {
  const db = await bookingDatabase(t)
  const { createAdminAppointmentsHandlers } = await import('../app/api/admin/appointments/route.js')
  const handlers = createAdminAppointmentsHandlers({ adminContext: async () => ({ db: rpcClient(db), auth: { user: { id: adminId } } }), guardMutationRequest: async () => null, notify: async () => ({ outcomePersisted: false }) })
  const response = await handlers.POST(request({ serviceId: 1, startsAt: await futureSlot(db), staffPreference: 1, customerName: 'Warning Guest', customerPhone: '91234567' }))
  assert.equal(response.status, 201)
  assert.equal((await response.json()).notificationWarning, true)
})

test('dashboard failure classifier consumes the persisted notification outcome fields', async () => {
  const { __testing } = await import('../app/api/admin/operations/route.js')
  assert.equal(__testing.failed({ email: { ok: true }, supabase: { ok: true } }), false)
  assert.equal(__testing.failed({ email: { ok: false, reason: 'provider_failed' }, supabase: { ok: true } }), true)
  assert.equal(__testing.failed({ whatsapp: { ok: false, mode: 'dry_run' } }), false)
})

test('audited admin booking commands commit their audit or roll the appointment mutation back', async t => {
  // Mutation caught: a best-effort route audit that leaves an admin-created or
  // cancelled booking durable after its required audit write fails.
  const db = await bookingDatabase(t)
  const startsAt = await futureSlot(db)
  const input = { p_actor_id: adminId, p_service_id: 1, p_starts_at: startsAt, p_staff_preference: '1', p_customer_name: 'Audit Guest', p_customer_phone: '91234567', p_customer_email: null, p_customer_id: null, p_customer_package_id: null, p_confirmation_token_hash: 'a'.repeat(64), p_customer_notes: null }
  const created = await callSql(db, 'admin_create_appointment_audited', input)
  assert.equal(created.source, 'admin')
  assert.deepEqual((await db.query("select action, actor_id from public.admin_audit_logs where action='appointment.create' order by id desc limit 1")).rows, [{ action: 'appointment.create', actor_id: adminId }])
  await db.exec(`create function public.reject_appointment_audit() returns trigger language plpgsql as $$ begin if new.action='appointment.create' then raise exception 'audit_insert_failed'; end if; return new; end $$; create trigger reject_appointment_audit before insert on public.admin_audit_logs for each row execute function public.reject_appointment_audit();`)
  await assert.rejects(callSql(db, 'admin_create_appointment_audited', { ...input, p_starts_at: await futureSlot(db, 4) }), /audit_insert_failed/)
  assert.equal((await db.query("select count(*)::int as count from public.appointments where customer_name='Audit Guest'")).rows[0].count, 1)
})

test('operations workspace declares staff, status and service filtering with an assigned-staff calendar row', async () => {
  // Source assertions are supplementary to the mounted route checks above;
  // they ensure the rendered workspace continues to expose its required UI.
  const [calendar, shell, dashboard, staff] = await Promise.all([
    read('app/admin/components/BookingCalendar.jsx'), read('app/admin/AdminShell.jsx'),
    read('app/admin/components/DashboardModule.jsx'), read('app/admin/components/StaffModule.jsx'),
  ])
  assert.match(calendar, /staffName|staff_name/)
  assert.match(calendar, /statusFilter/)
  assert.match(calendar, /serviceFilter/)
  assert.match(calendar, /日|週/)
  assert.match(shell, /DashboardModule/)
  assert.match(dashboard, /今日預約|待確認/)
  assert.match(staff, /StaffHoursEditor/)
})
