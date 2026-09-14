import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function reducer() {
  try {
    return (await import('../app/booking/components/booking-reducer.js')).bookingReducer
  } catch {
    assert.fail('bookingReducer implementation is unavailable')
  }
}

const populatedState = {
  step: 3,
  serviceId: 2,
  staffPreference: 4,
  date: '2026-10-01',
  startsAt: '2026-10-01T10:00:00+08:00',
  contact: { name: '陳小姐', phone: '91234567', email: 'guest@example.com' },
  customerPackageId: 9,
  acceptedTerms: true,
  submitting: false,
  error: '',
}

test('changing service clears dependent staff and slot choices', async () => {
  // Mutation caught: retaining a staff member or slot that may not support the new service.
  const bookingReducer = await reducer()
  const next = bookingReducer(populatedState, { type: 'SELECT_SERVICE', serviceId: 7 })
  assert.equal(next.serviceId, 7)
  assert.equal(next.staffPreference, 'any')
  assert.equal(next.startsAt, '')
  assert.equal(next.customerPackageId, '')
})

test('changing staff clears the previously selected slot', async () => {
  // Mutation caught: submitting a slot that was available only for the previous staff preference.
  const bookingReducer = await reducer()
  const next = bookingReducer(populatedState, { type: 'SELECT_STAFF', staffPreference: 8 })
  assert.equal(next.staffPreference, 8)
  assert.equal(next.startsAt, '')
  assert.equal(next.date, '2026-10-01')
})

test('a slot conflict keeps completed booking choices for retry', async () => {
  // Mutation caught: clearing the selected service, staff, time, or contact after the API returns 409.
  const bookingReducer = await reducer()
  const next = bookingReducer(populatedState, {
    type: 'SUBMIT_ERROR',
    error: '這個時段剛被預約，請選擇另一個時間。',
    status: 409,
  })
  assert.equal(next.error, '這個時段剛被預約，請選擇另一個時間。')
  assert.equal(next.serviceId, 2)
  assert.equal(next.staffPreference, 4)
  assert.equal(next.startsAt, '2026-10-01T10:00:00+08:00')
  assert.deepEqual(next.contact, populatedState.contact)
})

test('wizard components expose the accessible five-step booking journey', async () => {
  // Mutation caught: removing progress semantics, live availability feedback, or a focused step.
  const files = await Promise.all([
    'BookingWizard.jsx', 'ServiceStep.jsx', 'StaffStep.jsx', 'TimeStep.jsx', 'ContactStep.jsx', 'ReviewStep.jsx',
  ].map(async (file) => readFile(new URL(`../app/booking/components/${file}`, import.meta.url), 'utf8').catch(() => '')))
  const source = files.join('\n')
  assert.match(source, /aria-current=.*['"]step['"]/)
  assert.match(source, /aria-live=["']polite["']/)
  assert.match(source, /\/api\/staff/)
  assert.match(source, /\/api\/availability/)
  assert.match(source, /\/api\/appointments/)
  assert.match(source, /\/api\/customers\/me/)
  assert.match(source, /自費付款/)
  assert.doesNotMatch(source, /\/api\/customers\?phone=/)
})

test('public services route returns published booking fields', async () => {
  // Mutation caught: exposing disabled services or omitting fields the service step needs.
  const { createServicesHandler } = await import('../app/api/services/route.js')
  const calls = []
  const db = {
    from(table) {
      assert.equal(table, 'services')
      return {
        select(fields) { calls.push(['select', fields]); return this },
        eq(field, value) { calls.push(['eq', field, value]); return this },
        order(field) { calls.push(['order', field]); return Promise.resolve({
          data: [{ id: 7, name: '頭皮護理', price: 68000, duration_minutes: 60, category: 'treatment' }], error: null,
        }) },
      }
    },
  }
  const response = await createServicesHandler({ getServiceClient: async () => db })()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    services: [{ id: 7, name: '頭皮護理', price: 68000, duration_minutes: 60, category: 'treatment' }],
  })
  assert.deepEqual(calls, [
    ['select', 'id,name,price,duration_minutes,category'],
    ['eq', 'published', true],
    ['eq', 'enabled', true],
    ['order', 'sort_order'],
  ])
})
