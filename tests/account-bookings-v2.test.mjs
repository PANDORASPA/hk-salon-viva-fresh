import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import test from 'node:test'

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
  assert.deepEqual(ownerCalls[0].filters, [['id', 42], ['user_id', ownerId]])

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

test('guest booking confirmation navigation carries the generated capability token', async () => {
  // Mutation caught: sending a newly created guest to an id-only confirmation URL.
  const { confirmationUrl } = await import('../app/booking/components/booking-confirmation.js')
  assert.equal(confirmationUrl({ appointment: { id: 42 } }), '/booking/confirm')
  assert.equal(confirmationUrl({ appointment: { id: 42 }, confirmationToken: token }), `/booking/confirm?id=42&token=${encodeURIComponent(token)}`)
})
