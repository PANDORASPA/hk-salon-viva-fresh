import assert from 'node:assert/strict'
import test from 'node:test'

import availabilityModule from '../lib/booking/salon-availability.js'
const { buildAvailability, hkLocalToUtc, hkLocalToIso, hkDateWindow } = availabilityModule

test('HK is fixed UTC+8 (no daylight saving) so conversion is straightforward', () => {
  // 10:00 HK = 02:00 UTC, year-round
  assert.equal(hkLocalToUtc('2026-01-15', '10:00').toISOString(), '2026-01-15T02:00:00.000Z')
  assert.equal(hkLocalToUtc('2026-07-15', '10:00').toISOString(), '2026-07-15T02:00:00.000Z')
})

test('hkLocalToIso produces offset-aware strings the booking API can store verbatim', () => {
  assert.equal(hkLocalToIso('2026-09-10', '10:00'), '2026-09-10T10:00:00+08:00')
  assert.equal(hkLocalToIso('2026-09-10', '14:30'), '2026-09-10T14:30:00+08:00')
  assert.equal(hkLocalToIso('2026-09-10', '00:00'), '2026-09-10T00:00:00+08:00')
})

test('HK date window covers the correct UTC interval', () => {
  const win = hkDateWindow('2026-09-10')
  // 2026-09-10 00:00 HK = 2026-09-09 16:00 UTC
  assert.equal(win.start.toISOString(), '2026-09-09T16:00:00.000Z')
  // 2026-09-11 00:00 HK = 2026-09-10 16:00 UTC
  assert.equal(win.end.toISOString(), '2026-09-10T16:00:00.000Z')
})

test('availability returns slots with both label (HK) and iso (offset-aware)', () => {
  const slots = buildAvailability({
    date: '2026-08-20',
    durationMinutes: 60,
    bufferMinutes: 15,
    hours: { is_open: true, opens_at: '10:00', closes_at: '14:00' },
    blocked: false,
    appointments: [],
  })
  // 75-min step, 60-min service + 15-min buffer = 75-min consumed per slot.
  // 10:00, 11:15, 12:30 all fit (12:30 + 75 = 13:45 ≤ 14:00).
  assert.equal(slots.length, 3)
  assert.equal(slots[0].label, '10:00')
  assert.equal(slots[0].iso, '2026-08-20T10:00:00+08:00')
  assert.equal(slots[1].label, '11:15')
  assert.equal(slots[1].iso, '2026-08-20T11:15:00+08:00')
  assert.equal(slots[2].label, '12:30')
  assert.equal(slots[2].iso, '2026-08-20T12:30:00+08:00')
})

test('availability removes slots overlapping an existing appointment in HK time', () => {
  // 10:00–11:00 HK booked → 10:00 slot blocked, 11:15 + 12:30 still open
  // (11:15 + 60 + 15 = 12:30, 12:30 + 60 + 15 = 13:45 — neither overlaps 10:00-11:00)
  const slots = buildAvailability({
    date: '2026-08-20',
    durationMinutes: 60,
    bufferMinutes: 15,
    hours: { is_open: true, opens_at: '10:00', closes_at: '14:00' },
    blocked: false,
    appointments: [{
      starts_at: '2026-08-20T10:00:00+08:00',
      ends_at: '2026-08-20T11:00:00+08:00',
      status: 'confirmed',
    }],
  })
  assert.deepEqual(slots.map((s) => s.label), ['11:15', '12:30'])
})

test('availability returns no slots for closed or blocked dates', () => {
  const base = {
    date: '2026-08-20',
    durationMinutes: 60,
    hours: { is_open: true, opens_at: '10:00', closes_at: '18:00' },
    appointments: [],
  }
  assert.deepEqual(buildAvailability({ ...base, blocked: true }), [])
  assert.deepEqual(buildAvailability({ ...base, hours: { is_open: false } }), [])
})

test('legacy alias `londonLocalToUtc` points at the HK helper for back-compat', () => {
  // Anything still importing the old name should get HK semantics, not
  // silently re-introduce the Europe/London bug.
  assert.equal(
    availabilityModule.londonLocalToUtc('2026-09-10', '10:00').toISOString(),
    '2026-09-10T02:00:00.000Z',
  )
  assert.equal(
    availabilityModule.londonDateWindow('2026-09-10').start.toISOString(),
    '2026-09-09T16:00:00.000Z',
  )
})
