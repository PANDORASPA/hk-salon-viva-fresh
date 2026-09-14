import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

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

test('slot conflict returns to time selection without losing contact or package choice', async () => {
  // Mutation caught: leaving a rejected slot selected or wiping details needed to retry.
  const bookingReducer = await reducer()
  const next = bookingReducer(populatedState, { type: 'SLOT_CONFLICT', error: '這個時段剛被預約，請選擇另一個時間。' })
  assert.equal(next.step, 3)
  assert.equal(next.startsAt, '')
  assert.equal(next.serviceId, 2)
  assert.equal(next.staffPreference, 4)
  assert.equal(next.customerPackageId, 9)
  assert.deepEqual(next.contact, populatedState.contact)
})

test('Hong Kong date minimum remains today at a near-midnight boundary', async () => {
  // Mutation caught: using the browser/UTC calendar date or adding an unnecessary day.
  const { hongKongDate } = await import('../app/booking/components/booking-time.js')
  assert.equal(hongKongDate(new Date('2026-09-14T15:59:00.000Z')), '2026-09-14')
  assert.equal(hongKongDate(new Date('2026-09-14T16:01:00.000Z')), '2026-09-15')
})

test('review renderer keeps appointment time in Hong Kong when process timezone is New York', async () => {
  // Mutation caught: formatting in the browser/process default timezone instead of Asia/Hong_Kong.
  const { default: ReviewStep } = await import('../app/booking/components/ReviewStep.js')
  const previousZone = process.env.TZ
  process.env.TZ = 'America/New_York'
  try {
    const markup = renderToStaticMarkup(React.createElement(ReviewStep, {
      state: { ...populatedState, customerPackageId: '', startsAt: '2026-10-01T00:30:00+08:00' },
      service: { name: '護理' }, staff: { displayName: 'Amy' }, packages: [], authenticated: false,
      onPackageChange() {}, onTermsChange() {}, onSubmit() {},
    }))
    assert.match(markup, /1\/10\/2026.*00:30/)
  } finally {
    process.env.TZ = previousZone
  }
})

test('authenticated package loading distinguishes an empty account from a failed request', async () => {
  // Mutation caught: presenting self-pay as an implicit fallback when /me fails.
  const { packageResult } = await import('../app/booking/components/booking-data.js')
  assert.deepEqual(packageResult([]), { status: 'empty', packages: [] })
  assert.deepEqual(packageResult([{ id: 9 }]), { status: 'ready', packages: [{ id: 9 }] })
  assert.deepEqual(packageResult(null, '暫時無法載入套票'), { status: 'error', packages: [], error: '暫時無法載入套票' })
})

test('availability refresh request replaces stale slots after a conflict', async () => {
  // Mutation caught: retaining the rejected slot because no new availability request occurs.
  const { loadAvailability } = await import('../app/booking/components/booking-data.js')
  const calls = []
  const fetcher = async (url) => {
    calls.push(url)
    return { ok: true, json: async () => ({ slots: calls.length === 1 ? [{ label: '10:00', iso: 'first' }] : [{ label: '10:30', iso: 'second' }] }) }
  }
  const input = { date: '2026-10-01', serviceId: 2, staffPreference: 4 }
  assert.deepEqual((await loadAvailability(fetcher, input)).slots, [{ label: '10:00', iso: 'first' }])
  assert.deepEqual((await loadAvailability(fetcher, input)).slots, [{ label: '10:30', iso: 'second' }])
  assert.equal(calls.length, 2)
  assert.match(calls[1], /staffId=4/)
})

test('rendered staff choices use native radios and hide old rows while loading or failed', async () => {
  // Mutation caught: inaccessible button-role radios or selectable staff from the prior service.
  const { default: StaffStep } = await import('../app/booking/components/StaffStep.js')
  const staff = [{ id: 4, displayName: '舊服務員工', bio: '不應再可選' }]
  const loading = renderToStaticMarkup(React.createElement(StaffStep, { staff, staffPreference: 'any', loading: true, error: '', onSelect() {}, onRetry() {} }))
  const failed = renderToStaticMarkup(React.createElement(StaffStep, { staff, staffPreference: 'any', loading: false, error: '載入失敗', onSelect() {}, onRetry() {} }))
  const ready = renderToStaticMarkup(React.createElement(StaffStep, { staff, staffPreference: 4, loading: false, error: '', onSelect() {}, onRetry() {} }))
  assert.doesNotMatch(loading, /舊服務員工/)
  assert.doesNotMatch(failed, /舊服務員工/)
  assert.match(ready, /type="radio"/)
  assert.match(ready, /name="staff-preference"/)
  assert.match(ready, /checked=""/)
})

test('review rendering blocks self-pay fallback while authenticated package loading failed', async () => {
  // Mutation caught: allowing an account holder to book self-pay without seeing their package-load failure.
  const { default: ReviewStep } = await import('../app/booking/components/ReviewStep.js')
  const markup = renderToStaticMarkup(React.createElement(ReviewStep, {
    state: { ...populatedState, submitting: false }, service: { name: '護理' }, staff: { displayName: 'Amy' }, packages: [],
    packageState: { status: 'error', packages: [], error: '暫時無法載入套票' }, authenticated: true,
    onPackageChange() {}, onTermsChange() {}, onSubmit() {}, onRetryPackages() {},
  }))
  assert.match(markup, /暫時無法載入套票/)
  assert.match(markup, /重新載入套票/)
  assert.doesNotMatch(markup, /自費付款/)
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
