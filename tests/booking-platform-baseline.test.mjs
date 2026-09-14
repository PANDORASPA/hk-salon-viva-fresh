import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

test('the unit-test interface is stable for the booking platform', () => {
  assert.equal(packageJson.scripts['test:unit'], 'node --test tests/*.test.mjs')
  assert.equal(packageJson.scripts.test, 'npm run test:unit')
})

test('canonical booking routes query appointments, not legacy bookings, at runtime', async () => {
  const [availabilityRoute, appointmentsRoute, accountRoute] = await Promise.all([
    import('../app/api/availability/route.js'),
    import('../app/api/appointments/route.js'),
    import('../app/api/account/bookings/[id]/route.js'),
  ])
  const tables = []
  const query = (table) => {
    const value = table === 'services' ? { duration_minutes: 60 } : table === 'business_hours'
      ? { is_open: true, opens_at: '10:00', closes_at: '18:00' } : table === 'appointments'
        ? { id: 99, user_id: 'user-1', starts_at: '2099-09-10T02:00:00.000Z', ends_at: '2099-09-10T03:00:00.000Z', status: 'pending' } : null
    const chain = { select() { return this }, eq() { return this }, neq() { return this }, gte() { return this }, lt() { return this }, lte() { return this }, limit() { return this }, insert() { return this }, single: async () => ({ data: value, error: null }), maybeSingle: async () => ({ data: value, error: null }) }
    return chain
  }
  const db = { from(table) { tables.push(table); return query(table) } }
  const userDb = { auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) }, from(table) { tables.push(table); return query(table) } }
  availabilityRoute.__setAvailabilityRouteDependencies({ getServiceClient: () => db })
  appointmentsRoute.__setAppointmentsRouteDependencies({ getServiceClient: () => db })
  accountRoute.__setAccountBookingRouteDependencies({ getServerClient: async () => userDb, getServiceClient: () => db })

  const availability = await availabilityRoute.GET(new Request('http://localhost/api/availability?date=2099-09-10&serviceId=1'))
  assert.equal(availability.status, 200)
  const appointment = await appointmentsRoute.POST(new Request('http://localhost/api/appointments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ serviceId: 1, customerName: 'Test User', customerPhone: '91234567', startsAt: '2099-09-10T02:00:00.000Z' }),
  }))
  assert.equal(appointment.status, 201)
  const account = await accountRoute.GET(new Request('http://localhost/api/account/bookings/99'), { params: { id: '99' } })
  assert.equal(account.status, 200)
  assert.equal(tables.filter((table) => table === 'appointments').length >= 3, true, 'all canonical route handlers must query appointments')
  assert.equal(tables.includes('bookings'), false, 'canonical booking routes must never query bookings')
})
