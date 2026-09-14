import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import availabilityModule from '../lib/booking/salon-availability.js'
import * as packageUsageModule from '../lib/booking/package-usage.js'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

test('the unit-test interface is stable for the booking platform', () => {
  assert.equal(packageJson.scripts['test:unit'], 'node --test tests/*.test.mjs')
  assert.equal(packageJson.scripts.test, 'npm run test:unit')
})

test('canonical booking modules use appointments and package tables at runtime', async () => {
  const availability = availabilityModule.buildAvailability({
    date: '2026-09-10',
    durationMinutes: 60,
    hours: { is_open: true, opens_at: '10:00', closes_at: '13:00' },
    blocked: false,
    appointments: [{
      starts_at: '2026-09-10T10:00:00+08:00',
      ends_at: '2026-09-10T11:00:00+08:00',
      status: 'confirmed',
    }],
  })
  assert.deepEqual(availability.map(({ label }) => label), ['11:15'])

  const tables = []
  const query = {
    select() { return this },
    eq() { return this },
    maybeSingle: async () => ({
      data: {
        id: 42,
        customer_id: 7,
        sessions_remaining: 1,
        is_active: true,
        expires_at: '2099-01-01T00:00:00.000Z',
      },
      error: null,
    }),
  }
  const db = { from(table) { tables.push(table); return query } }
  const result = await packageUsageModule.findRedeemableCustomerPackage(db, {
    customerPackageId: 42,
    customerId: 7,
  })

  assert.equal(result.data.id, 42)
  assert.deepEqual(tables, ['customer_packages'])
  assert.equal(tables.includes('bookings'), false)
})
