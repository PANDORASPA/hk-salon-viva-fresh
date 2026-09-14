import assert from 'node:assert/strict'
import test from 'node:test'
import { validateBookingWindow } from '../lib/booking/rules.js'
import { buildStaffAvailability } from '../lib/booking/availability-v2.js'

const now = new Date('2026-09-14T10:00:00+08:00')

test('rejects a slot inside minimum lead time', () => {
  assert.deepEqual(validateBookingWindow({
    startsAt: '2026-09-14T11:00:00+08:00', now,
    minimumLeadMinutes: 120, maximumAdvanceDays: 90,
  }), { ok: false, code: 'booking_window_invalid' })
})

test('removes overlaps, buffer, time off, closed hours and unskilled staff', () => {
  const result = buildStaffAvailability({
    date: '2026-09-16', now,
    service: { id: 7, duration_minutes: 60 },
    staff: [
      { id: 1, is_active: true, service_ids: [7] },
      { id: 2, is_active: true, service_ids: [8] },
      { id: 3, is_active: false, service_ids: [7] },
    ],
    weeklyHours: [
      { staff_id: 1, weekday: 3, is_working: true, starts_at: '10:00', ends_at: '13:00' },
      { staff_id: 2, weekday: 3, is_working: true, starts_at: '10:00', ends_at: '13:00' },
    ],
    timeOff: [{ staff_id: 1, starts_at: '2026-09-16T12:45:00+08:00', ends_at: '2026-09-16T13:00:00+08:00' }],
    appointments: [{ staff_id: 1, status: 'confirmed', starts_at: '2026-09-16T10:00:00+08:00', occupied_until: '2026-09-16T11:15:00+08:00' }],
    businessHours: { weekday: 3, is_open: true, opens_at: '09:00', closes_at: '13:00' },
    blocked: false,
    settings: { stepMinutes: 30, bufferMinutes: 15 },
  })
  assert.deepEqual(result.staffAvailability['1'], ['2026-09-16T11:30:00+08:00'])
  assert.deepEqual(result.staffAvailability['2'], [])
  assert.deepEqual(result.staffAvailability['3'], [])
  assert.deepEqual(result.slots, [{ label: '11:30', iso: '2026-09-16T11:30:00+08:00', staffIds: [1] }])
})

test('uses any-staff union, filters blocked date and rejects cross-midnight service', () => {
  const base = {
    date: '2026-09-16', now, service: { id: 7, duration_minutes: 60 },
    staff: [{ id: 2, is_active: true, service_ids: [7] }],
    weeklyHours: [{ staff_id: 2, weekday: 3, is_working: true, starts_at: '10:00', ends_at: '12:00' }],
    businessHours: { weekday: 3, is_open: true, opens_at: '09:00', closes_at: '18:00' },
  }
  assert.equal(buildStaffAvailability({ ...base, blocked: true }).slots.length, 0)
  assert.equal(buildStaffAvailability({ ...base, service: { id: 7, duration_minutes: 180 }, settings: { bufferMinutes: 15 } }).slots.length, 0)
  assert.deepEqual(buildStaffAvailability({ ...base, settings: { stepMinutes: 30, bufferMinutes: 0 } }).slots.map(x => x.label), ['10:00', '10:30', '11:00'])
})

test('enforces booking lead time and maximum horizon', () => {
  assert.equal(validateBookingWindow({ startsAt: '2026-09-14T12:00:00+08:00', now, minimumLeadMinutes: 120, maximumAdvanceDays: 90 }).ok, true)
  assert.equal(validateBookingWindow({ startsAt: '2026-12-14T10:00:00+08:00', now, minimumLeadMinutes: 0, maximumAdvanceDays: 90 }).ok, false)
})

const simpleFixture = (overrides = {}) => ({
  date: '2026-09-16', now,
  service: { id: 7, duration_minutes: 30 },
  staff: [{ id: 1, is_active: true, service_ids: [7] }],
  weeklyHours: [{ staff_id: 1, weekday: 3, is_working: true, starts_at: '10:00', ends_at: '12:00' }],
  businessHours: { weekday: 3, is_open: true, opens_at: '10:00', closes_at: '12:00' },
  settings: { stepMinutes: 15, bufferMinutes: 15 },
  ...overrides,
})

for (const status of ['pending', 'confirmed', 'completed']) {
  test(`blocks an appointment with active status ${status}`, () => {
    const result = buildStaffAvailability(simpleFixture({
      appointments: [{ staff_id: 1, status, starts_at: '2026-09-16T10:00:00+08:00', occupied_until: '2026-09-16T10:45:00+08:00' }],
    }))
    assert.equal(result.staffAvailability['1'].includes('2026-09-16T10:00:00+08:00'), false)
  })
}

for (const status of ['cancelled', 'no_show']) {
  test(`does not block an appointment with non-active status ${status}`, () => {
    const result = buildStaffAvailability(simpleFixture({
      appointments: [{ staff_id: 1, status, starts_at: '2026-09-16T10:00:00+08:00', occupied_until: '2026-09-16T10:45:00+08:00' }],
    }))
    assert.equal(result.staffAvailability['1'].includes('2026-09-16T10:00:00+08:00'), true)
  })
}

test('allows exact buffer-boundary adjacency', () => {
  const result = buildStaffAvailability(simpleFixture({
    appointments: [{ staff_id: 1, status: 'confirmed', starts_at: '2026-09-16T10:00:00+08:00', occupied_until: '2026-09-16T10:45:00+08:00' }],
  }))
  assert.equal(result.staffAvailability['1'].includes('2026-09-16T10:45:00+08:00'), true)
})

test('allows exact time-off-boundary adjacency', () => {
  const result = buildStaffAvailability(simpleFixture({
    timeOff: [{ staff_id: 1, starts_at: '2026-09-16T10:45:00+08:00', ends_at: '2026-09-16T11:00:00+08:00' }],
  }))
  assert.equal(result.staffAvailability['1'].includes('2026-09-16T10:00:00+08:00'), true)
})

test('applies default step and buffer settings', () => {
  const result = buildStaffAvailability(simpleFixture({ settings: undefined }))
  assert.deepEqual(result.staffAvailability['1'], [
    '2026-09-16T10:00:00+08:00',
    '2026-09-16T10:30:00+08:00',
    '2026-09-16T11:00:00+08:00',
  ])
})

test('does not qualify staff with absent service mapping', () => {
  const result = buildStaffAvailability(simpleFixture({ staff: [{ id: 1, is_active: true }] }))
  assert.deepEqual(result.slots, [])
  assert.deepEqual(result.staffAvailability['1'], [])
})

test('rejects an invalid injected now for availability', () => {
  const result = buildStaffAvailability(simpleFixture({ now: 'not-a-date' }))
  assert.deepEqual(result, { slots: [], staffAvailability: { '1': [] } })
})

test('rejects an invalid injected now for booking-window validation', () => {
  assert.deepEqual(validateBookingWindow({ startsAt: '2026-09-16T10:00:00+08:00', now: 'not-a-date' }), {
    ok: false, code: 'booking_window_invalid',
  })
})

for (const invalidNow of [null, undefined, '']) {
  test(`rejects ${invalidNow === undefined ? 'missing' : JSON.stringify(invalidNow)} injected clock for booking-window validation`, () => {
    assert.deepEqual(validateBookingWindow({ startsAt: '1970-01-01T10:00:00+08:00', now: invalidNow }), {
      ok: false, code: 'booking_window_invalid',
    })
  })

  test(`returns no availability for ${invalidNow === undefined ? 'missing' : JSON.stringify(invalidNow)} injected clock`, () => {
    const result = buildStaffAvailability(simpleFixture({
      date: '1970-01-01', now: invalidNow,
      weeklyHours: [{ staff_id: 1, weekday: 4, is_working: true, starts_at: '10:00', ends_at: '12:00' }],
      businessHours: { weekday: 4, is_open: true, opens_at: '10:00', closes_at: '12:00' },
    }))
    assert.deepEqual(result, { slots: [], staffAvailability: { '1': [] } })
  })
}

test('does not qualify staff with an empty service mapping', () => {
  const result = buildStaffAvailability(simpleFixture({ staff: [{ id: 1, is_active: true, service_ids: [] }] }))
  assert.deepEqual(result.slots, [])
  assert.deepEqual(result.staffAvailability['1'], [])
})

test('enforces lead time and horizon while building availability', () => {
  assert.deepEqual(buildStaffAvailability(simpleFixture({
    date: '2026-09-14', now: '2026-09-14T10:00:00+08:00',
    weeklyHours: [{ staff_id: 1, weekday: 1, is_working: true, starts_at: '10:00', ends_at: '14:00' }],
    businessHours: { weekday: 1, is_open: true, opens_at: '10:00', closes_at: '14:00' },
  })).staffAvailability['1'], [
    '2026-09-14T12:00:00+08:00', '2026-09-14T12:15:00+08:00', '2026-09-14T12:30:00+08:00',
    '2026-09-14T12:45:00+08:00', '2026-09-14T13:00:00+08:00', '2026-09-14T13:15:00+08:00',
  ])
  assert.deepEqual(buildStaffAvailability(simpleFixture({
    date: '2026-12-14', now,
    weeklyHours: [{ staff_id: 1, weekday: 1, is_working: true, starts_at: '10:00', ends_at: '14:00' }],
    businessHours: { weekday: 1, is_open: true, opens_at: '10:00', closes_at: '14:00' },
  })).slots, [])
})
