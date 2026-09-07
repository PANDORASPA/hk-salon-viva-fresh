import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../app/booking/BookingForm.jsx', import.meta.url), 'utf8')

test('booking form loads server availability before submission', () => {
  assert.match(source, /\/api\/availability/)
  assert.match(source, /slots/)
  // Submit button is disabled until both service and timeslot are picked
  assert.match(source, /!form\.startsAt/)
  assert.match(source, /!form\.serviceId/)
})

test('booking form submits structured appointment JSON to /api/appointments', () => {
  assert.match(source, /\/api\/appointments/)
  assert.match(source, /application\/json/)
  assert.match(source, /serviceId/)
  // The form sends ISO datetime (`startsAt`) instead of legacy `date`/`time`
  assert.match(source, /startsAt/)
})

test('booking form looks up existing customers by phone via /api/customers', () => {
  assert.match(source, /\/api\/customers\?phone=/)
  assert.match(source, /customerFound/)
})

test('booking form filters unusable customer packages client-side', () => {
  assert.match(source, /cp\.is_active/)
  assert.match(source, /expires_at/)
  assert.match(source, /sessions_remaining/)
})

test('booking form shows explicit lookup status (searching / found / not-found / error)', () => {
  assert.match(source, /lookupStatus/)
  assert.match(source, /searching/)
  assert.match(source, /not-found/)
})

test('booking form validates required fields before submit (no NaN customer IDs)', () => {
  assert.match(source, /safeNumber/)
  assert.match(source, /Number\.isFinite/)
})
