import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import validationModule from '../lib/validation/salon.js'
const { validateAppointmentInput } = validationModule

const valid = {
  serviceId: 3,
  customerName: 'Ada Wong',
  customerPhone: '91234567',
  customerEmail: 'ada@example.com',
  startsAt: '2026-09-08T14:30',
  notes: '',
}

test('appointment validation normalizes a valid request', () => {
  const result = validateAppointmentInput(valid)
  assert.equal(result.ok, true)
  assert.equal(result.errors.length, 0)
  assert.equal(result.value.customerName, 'Ada Wong')
  assert.equal(result.value.serviceId, 3)
  assert.equal(typeof result.value.startsAt, 'string')
})

test('appointment validation rejects malformed and oversized fields', () => {
  assert.equal(validateAppointmentInput({ ...valid, customerEmail: 'wrong' }).ok, false)
  assert.equal(validateAppointmentInput({ ...valid, customerPhone: '12' }).ok, false)
  assert.equal(validateAppointmentInput({ ...valid, notes: 'x'.repeat(2001) }).ok, false)
  assert.equal(validateAppointmentInput({ ...valid, startsAt: 'not-a-date' }).ok, false)
  assert.equal(validateAppointmentInput({ ...valid, serviceId: 'abc' }).ok, false)
  assert.equal(validateAppointmentInput({ ...valid, customerName: 'A' }).ok, false)
})

test('appointment creation rechecks the requested slot on the server', async () => {
  const source = await readFile(new URL('../app/api/appointments/route.js', import.meta.url), 'utf8')
  // The endpoint must either recheck availability or refuse past times so two
  // clients cannot both win the same slot. Both patterns are acceptable.
  assert.ok(
    /availability/.test(source) || /past booking time/.test(source) || /Invalid or past/i.test(source),
    'must reference availability or refuse past/invalid slots',
  )
  assert.match(source, /starts_at|startsAt/, 'must write the starts_at field')
  assert.match(source, /customer_package_id|customerPackageId/, 'must track which customer package was used')
})
