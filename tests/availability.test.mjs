import assert from 'node:assert/strict'
import test from 'node:test'
import availabilityModule from '../lib/booking/salon-availability.js'
const { buildAvailability, londonLocalToUtc, londonDateWindow } = availabilityModule

test('London local conversion observes daylight saving time', () => {
  assert.equal(londonLocalToUtc('2026-01-15', '10:00').toISOString(), '2026-01-15T10:00:00.000Z')
  assert.equal(londonLocalToUtc('2026-07-15', '10:00').toISOString(), '2026-07-15T09:00:00.000Z')
})

test('London date windows cover the correct UTC interval across daylight saving', () => {
  const summer = londonDateWindow('2026-07-15')
  assert.equal(summer.start.toISOString(), '2026-07-14T23:00:00.000Z')
  assert.equal(summer.end.toISOString(), '2026-07-15T23:00:00.000Z')
})

test('availability removes overlaps and respects service duration', () => {
  const slots = buildAvailability({ date: '2026-08-20', durationMinutes: 60, bufferMinutes: 15, hours: { is_open: true, opens_at: '10:00', closes_at: '14:00' }, blocked: false, appointments: [{ starts_at: '2026-08-20T10:00:00.000Z', ends_at: '2026-08-20T11:00:00.000Z', status: 'confirmed' }] })
  assert.deepEqual(slots, ['12:30'])
})

test('availability returns no slots for closed or blocked dates', () => {
  const base = { date: '2026-08-20', durationMinutes: 60, hours: { is_open: true, opens_at: '10:00', closes_at: '18:00' }, appointments: [] }
  assert.deepEqual(buildAvailability({ ...base, blocked: true }), [])
  assert.deepEqual(buildAvailability({ ...base, hours: { is_open: false } }), [])
})
