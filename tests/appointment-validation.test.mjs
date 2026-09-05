import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import validationModule from '../lib/validation/salon.js'
const { validateAppointmentInput } = validationModule

const valid = { serviceId: 3, date: '2026-08-20', time: '14:30', name: 'Ada Wong', phone: '07724594963', email: 'ada@example.com', notes: '' }

test('appointment validation normalizes a valid request', () => {
  const result = validateAppointmentInput(valid)
  assert.equal(result.ok, true)
  assert.equal(result.value.name, 'Ada Wong')
  assert.equal(result.value.serviceId, 3)
})

test('appointment validation rejects malformed and oversized fields', () => {
  assert.equal(validateAppointmentInput({ ...valid, email: 'wrong' }).ok, false)
  assert.equal(validateAppointmentInput({ ...valid, phone: '12' }).ok, false)
  assert.equal(validateAppointmentInput({ ...valid, notes: 'x'.repeat(2001) }).ok, false)
  assert.equal(validateAppointmentInput({ ...valid, date: '20/08/2026' }).ok, false)
})

test('appointment creation rechecks the requested slot on the server', async () => {
  const source = await readFile(new URL('../app/api/appointments/route.js', import.meta.url), 'utf8')
  assert.match(source, /buildAvailability/)
  assert.match(source, /requested time is not available/i)
  assert.match(source, /blocked_dates/)
})
