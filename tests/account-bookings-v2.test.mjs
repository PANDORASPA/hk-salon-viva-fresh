import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import test from 'node:test'
import { AuthSessionMissingError } from '@supabase/supabase-js'
import { bookingDatabase, createSql, futureSlot, ownerId as databaseOwnerId, rpcClient } from './helpers/booking-database.mjs'

const ownerId = '11111111-1111-4111-8111-111111111111'
const otherUserId = '22222222-2222-4222-8222-222222222222'
const token = randomBytes(32).toString('base64url')
const appointment = {
  id: 42,
  reference: 'SP-42',
  user_id: ownerId,
  service_id: 7,
  staff_id: 3,
  starts_at: '2026-10-01T02:30:00.000Z',
  status: 'confirmed',
  customer_name: '陳小姐',
  services: { name: '頭皮護理', duration_minutes: 60, price: 68000 },
  staff: { display_name: 'Amy' },
  customer_package_id: 9,
  package_redemptions: [{
    customer_package_id: 9,
    redeemed_at: '2026-09-01T02:30:00.000Z',
    refunded_at: null,
    customer_packages: { sessions_remaining: 3, total_sessions: 6, packages: { name: '療程套票' } },
  }],
}

function queryDatabase(row, calls) {
  return {
    from(table) {
      const filters = []
      return {
        select(columns) { calls.push({ table, columns, filters }); return this },
        eq(field, value) { filters.push([field, value]); return this },
        maybeSingle: async () => ({ data: row, error: null }),
      }
    },
  }
}

test('a numeric confirmation id alone cannot load an appointment', async () => {
  // Mutation caught: restoring the previous public id-only appointment lookup.
  const { loadConfirmationAppointment } = await import('../lib/booking/confirmation.js')
  let databaseTouched = false
  const result = await loadConfirmationAppointment({
    id: '42',
    user: null,
    serverDatabase: { from() { databaseTouched = true } },
    serviceDatabase: { from() { databaseTouched = true } },
  })
  assert.equal(result, null)
  assert.equal(databaseTouched, false)
})

test('confirmation loader accepts only the owner or the matching unguessable token', async () => {
  // Mutation caught: trusting a client-supplied owner id, comparing raw tokens, or accepting a malformed token.
  const { loadConfirmationAppointment } = await import('../lib/booking/confirmation.js')
  const ownerCalls = []
  const owned = await loadConfirmationAppointment({
    id: '42', user: { id: ownerId },
    serverDatabase: queryDatabase(appointment, ownerCalls), serviceDatabase: { from() { throw new Error('owner must not need service lookup') } },
  })
  assert.equal(owned.id, 42)
  assert.deepEqual(ownerCalls[0].filters, [['id', 42]]) // Owner filtering is enforced by authenticated RLS; private user_id has no column grant.

  const tokenCalls = []
  const tokenBooking = await loadConfirmationAppointment({
    id: '42', confirmationToken: token, user: { id: otherUserId },
    serverDatabase: queryDatabase(null, []), serviceDatabase: queryDatabase(appointment, tokenCalls),
  })
  assert.equal(tokenBooking.reference, 'SP-42')
  assert.deepEqual(tokenCalls[0].filters, [
    ['id', 42],
    ['confirmation_token_hash', createHash('sha256').update(token).digest('hex')],
  ])
  assert.equal(JSON.stringify(tokenCalls).includes(token), false)

  const malformed = await loadConfirmationAppointment({
    id: '42', confirmationToken: 'short', user: null,
    serverDatabase: { from() { throw new Error('malformed token must not query') } },
    serviceDatabase: { from() { throw new Error('malformed token must not query') } },
  })
  assert.equal(malformed, null)
})

test('account booking view contains only customer-safe service, staff, Hong Kong time, status, and redemption data', async () => {
  // Mutation caught: leaking private appointment fields or dropping the staff/refund state the customer needs.
  const { toAccountBooking } = await import('../lib/booking/account-booking-view.js')
  assert.deepEqual(toAccountBooking({ ...appointment, admin_notes: 'private', confirmation_token_hash: 'private' }), {
    id: 42,
    reference: 'SP-42',
    serviceId: 7,
    staffId: 3,
    startsAt: '2026-10-01T02:30:00.000Z',
    timezone: 'Asia/Hong_Kong',
    status: 'confirmed',
    service: { name: '頭皮護理', durationMinutes: 60 },
    staff: { displayName: 'Amy' },
    packageRedemption: {
      packageId: 9,
      packageName: '療程套票',
      redeemedAt: '2026-09-01T02:30:00.000Z',
      refundedAt: null,
      sessionsRemaining: 3,
      totalSessions: 6,
    },
  })
})

test('account booking API returns the safe account view for the authenticated owner only', async () => {
  // Mutation caught: returning raw appointment rows, omitting the assigned staff/refund state, or trusting request ownership.
  const { createAccountBookingHandlers } = await import('../app/api/account/bookings/[id]/route.js')
  const calls = []
  const database = queryDatabase(appointment, calls)
  const serverDatabase = { auth: { getUser: async () => ({ data: { user: { id: ownerId } }, error: null }) }, from() { throw new Error('account reads must use the server-only service projection') } }
  const handler = createAccountBookingHandlers({ getServerClient: async () => serverDatabase, getServiceClient: async () => database })
  const response = await handler.GET(new Request('http://localhost/api/account/bookings/42'), {
    params: Promise.resolve({ id: '42' }),
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(await response.json(), {
    booking: {
      id: 42,
      reference: 'SP-42',
      serviceId: 7,
      staffId: 3,
      startsAt: '2026-10-01T02:30:00.000Z',
      timezone: 'Asia/Hong_Kong',
      status: 'confirmed',
      service: { name: '頭皮護理', durationMinutes: 60 },
      staff: { displayName: 'Amy' },
      packageRedemption: {
        packageId: 9,
        packageName: '療程套票',
        redeemedAt: '2026-09-01T02:30:00.000Z',
        refundedAt: null,
        sessionsRemaining: 3,
        totalSessions: 6,
      },
    },
  })
  assert.deepEqual(calls[0].filters, [['id', 42], ['user_id', ownerId]])
})

test('calendar download denies numeric ids but permits an owner or matching confirmation token', async () => {
  // Mutation caught: reintroducing the public id-only ICS endpoint.
  const { createIcsHandler } = await import('../lib/booking/confirmation-ics.js')
  const context = { params: Promise.resolve({ id: '42' }) }
  let touched = false
  const forbidden = createIcsHandler({
    getServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    getServiceClient: async () => ({ from() { touched = true } }),
  })
  assert.equal((await forbidden(new Request('http://localhost/api/appointments/42/ics'), context)).status, 404)
  assert.equal(touched, false)

  const tokenCalls = []
  const byToken = createIcsHandler({
    getServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    getServiceClient: async () => queryDatabase(appointment, tokenCalls),
  })
  const calendar = await byToken(new Request(`http://localhost/api/appointments/42/ics?token=${token}`), context)
  assert.equal(calendar.status, 200)
  assert.match(await calendar.text(), /SALON POKE BY VIVA/)
  assert.deepEqual(tokenCalls[0].filters.at(-1), ['confirmation_token_hash', createHash('sha256').update(token).digest('hex')])
})

test('ICS treats the real Supabase missing-session error as a guest token request, not an infrastructure failure', async () => {
  // Mutation caught: treating AuthSessionMissingError as a hard denial and breaking valid guest capability links.
  const { createIcsHandler } = await import('../lib/booking/confirmation-ics.js')
  const context = { params: Promise.resolve({ id: '42' }) }
  const handler = createIcsHandler({
    getServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: new AuthSessionMissingError() }) } }),
    getServiceClient: async () => queryDatabase(appointment, []),
  })
  const response = await handler(new Request(`http://localhost/api/appointments/42/ics?token=${token}`), context)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
})

test('ICS fails closed for a genuine Auth infrastructure error without querying a token-protected appointment', async () => {
  // Mutation caught: treating every auth error as signed out and allowing a capability read through an unhealthy auth boundary.
  const { createIcsHandler } = await import('../lib/booking/confirmation-ics.js')
  let serviceQueried = false
  const handler = createIcsHandler({
    getServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: new Error('auth service unavailable') }) } }),
    getServiceClient: async () => ({ from() { serviceQueried = true } }),
  })
  const response = await handler(new Request(`http://localhost/api/appointments/42/ics?token=${token}`), { params: Promise.resolve({ id: '42' }) })
  assert.equal(response.status, 503)
  assert.equal(serviceQueried, false)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
})

test('10:00 to 10:30 reschedule submits directly to the atomic PATCH command and preserves a 409 response', async () => {
  // Mutation caught: reintroducing an availability preflight that rejects overlap with the booking's own old occupancy.
  const { submitAccountReschedule } = await import('../app/account/reschedule-submission.js')
  const requests = []
  const success = await submitAccountReschedule({
    fetcher: async (url, init) => {
      requests.push({ url, init })
      return Response.json({ booking: { id: 42, startsAt: '2026-10-01T10:30:00+08:00' } })
    },
    bookingId: 42, date: '2026-10-01', time: '10:30', staffPreference: 3,
  })
  assert.deepEqual(success, { ok: true, booking: { id: 42, startsAt: '2026-10-01T10:30:00+08:00' } })
  assert.deepEqual(requests, [{
    url: '/api/account/bookings/42',
    init: { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: '2026-10-01', time: '10:30', staffPreference: 3 }) },
  }])
  const conflict = await submitAccountReschedule({
    fetcher: async () => Response.json({ error: '這個時段剛被預約，請選擇另一個時間。' }, { status: 409 }),
    bookingId: 42, date: '2026-10-01', time: '10:30', staffPreference: 3,
  })
  assert.deepEqual(conflict, { ok: false, status: 409, error: '這個時段剛被預約，請選擇另一個時間。' })
})

test('server refresh replaces every local row so package refund balances stay consistent', async () => {
  // Mutation caught: retaining stale package balances on appointments other than the one just cancelled.
  const { accountBookingsReducer } = await import('../app/account/account-booking-state.js')
  const current = [
    { id: 1, status: 'confirmed', packageRedemption: { packageId: 9, sessionsRemaining: 2 } },
    { id: 2, status: 'confirmed', packageRedemption: { packageId: 9, sessionsRemaining: 2 } },
  ]
  const refreshed = accountBookingsReducer(current, { type: 'SERVER_REFRESH', bookings: [
    { id: 1, status: 'cancelled', packageRedemption: { packageId: 9, sessionsRemaining: 3, refundedAt: '2026-10-01T01:00:00Z' } },
    { id: 2, status: 'confirmed', packageRedemption: { packageId: 9, sessionsRemaining: 3 } },
  ] })
  assert.deepEqual(refreshed, [
    { id: 1, status: 'cancelled', packageRedemption: { packageId: 9, sessionsRemaining: 3, refundedAt: '2026-10-01T01:00:00Z' } },
    { id: 2, status: 'confirmed', packageRedemption: { packageId: 9, sessionsRemaining: 3 } },
  ])
})

test('actual account PATCH moves 10:00 to 10:30 without preflight rejection and retains its old slot on a 409', async t => {
  // Mutation caught: deleting/releasing the old booking before the atomic command succeeds, or reintroducing client availability as an authority.
  const { createAccountBookingHandlers } = await import('../app/api/account/bookings/[id]/route.js')
  const db = await bookingDatabase(t)
  const server = async () => ({ auth: { getUser: async () => ({ data: { user: { id: databaseOwnerId } }, error: null }) } })
  const handlers = createAccountBookingHandlers({ getServerClient: server, getServiceClient: () => rpcClient(db), notify: async () => {} })
  const day = await futureSlot(db, 4, '10:00')
  const original = await createSql(db, {
    p_starts_at: day, p_staff_preference: '1', p_customer_id: 1, p_actor_id: databaseOwnerId, p_source: 'account',
  })
  const date = new Date(day).toLocaleDateString('sv-SE', { timeZone: 'Asia/Hong_Kong' })
  const patch = async (time) => handlers.PATCH(new Request(`http://localhost/api/account/bookings/${original.id}`, {
    method: 'PATCH', headers: { origin: 'http://localhost', 'content-type': 'application/json', 'x-real-ip': `task8-${time}` },
    body: JSON.stringify({ date, time, staffPreference: 1 }),
  }), { params: Promise.resolve({ id: String(original.id) }) })

  const moved = await patch('10:30')
  assert.equal(moved.status, 200)
  assert.equal((await db.query('select starts_at from public.appointments where id=$1', [original.id])).rows[0].starts_at.toISOString(), await futureSlot(db, 4, '10:30'))

  const conflictTarget = await futureSlot(db, 5, '10:00')
  await createSql(db, { p_starts_at: conflictTarget, p_staff_preference: '1' })
  const conflictDate = new Date(conflictTarget).toLocaleDateString('sv-SE', { timeZone: 'Asia/Hong_Kong' })
  const conflict = await handlers.PATCH(new Request(`http://localhost/api/account/bookings/${original.id}`, {
    method: 'PATCH', headers: { origin: 'http://localhost', 'content-type': 'application/json', 'x-real-ip': 'task8-conflict' },
    body: JSON.stringify({ date: conflictDate, time: '10:00', staffPreference: 1 }),
  }), { params: Promise.resolve({ id: String(original.id) }) })
  assert.equal(conflict.status, 409)
  assert.equal((await db.query('select starts_at from public.appointments where id=$1', [original.id])).rows[0].starts_at.toISOString(), await futureSlot(db, 4, '10:30'))
})

test('guest booking confirmation navigation carries the generated capability token', async () => {
  // Mutation caught: sending a newly created guest to an id-only confirmation URL.
  const { confirmationUrl } = await import('../app/booking/components/booking-confirmation.js')
  assert.equal(confirmationUrl({ appointment: { id: 42 } }), '/booking/confirm')
  assert.equal(confirmationUrl({ appointment: { id: 42 }, confirmationToken: token }), `/booking/confirm?id=42&token=${encodeURIComponent(token)}`)
})
