import assert from 'node:assert/strict'
import test from 'node:test'

import csvLib from '../lib/csv/parse.js'
const { parseCsv } = csvLib

test('parses a simple header + 2 rows', () => {
  const out = parseCsv('name,phone\nAda,91234567\nBob,98765432\n')
  assert.deepEqual(out.headers, ['name', 'phone'])
  assert.equal(out.rows.length, 2)
  assert.equal(out.rows[0].name, 'Ada')
  assert.equal(out.rows[1].phone, '98765432')
})

test('strips a leading UTF-8 BOM', () => {
  const out = parseCsv('\uFEFFname,phone\nAda,91234567\n')
  assert.deepEqual(out.headers, ['name', 'phone'])
  assert.equal(out.rows.length, 1)
  assert.equal(out.rows[0].name, 'Ada')
})

test('handles quoted fields containing commas', () => {
  const out = parseCsv('name,phone,notes\n"Lee, Ada","9123 4567","VIP, high priority"\n')
  assert.equal(out.rows[0].name, 'Lee, Ada')
  assert.equal(out.rows[0].phone, '9123 4567')
  assert.equal(out.rows[0].notes, 'VIP, high priority')
})

test('handles escaped double quotes inside quoted fields', () => {
  const out = parseCsv('name,phone\n"He said ""hi""",9123\n')
  assert.equal(out.rows[0].name, 'He said "hi"')
})

test('handles CRLF line endings', () => {
  const out = parseCsv('a,b\r\n1,2\r\n3,4\r\n')
  assert.equal(out.rows.length, 2)
  assert.equal(out.rows[1].a, '3')
})

test('handles bare CR line endings', () => {
  const out = parseCsv('a,b\r1,2\r3,4\r')
  assert.equal(out.rows.length, 2)
})

test('handles newlines inside quoted fields', () => {
  const out = parseCsv('a,b\n"line1\nline2",x\n')
  assert.equal(out.rows[0].a, 'line1\nline2')
  assert.equal(out.rows[0].b, 'x')
})

test('accepts explicit headers when CSV has no header row', () => {
  const out = parseCsv('Ada,9123\nBob,9876\n', { headers: ['name', 'phone'] })
  assert.deepEqual(out.headers, ['name', 'phone'])
  assert.equal(out.rows.length, 2)
  assert.equal(out.rows[0].name, 'Ada')
})

test('returns empty rows when input has only a header', () => {
  const out = parseCsv('name,phone\n')
  assert.equal(out.rows.length, 0)
})

test('skips fully-empty lines when skipEmptyLines is true (default)', () => {
  const out = parseCsv('name,phone\nAda,1\n\n\nBob,2\n')
  assert.equal(out.rows.length, 2)
})

test('missing column yields empty string', () => {
  const out = parseCsv('name,phone\nAda\n')
  assert.equal(out.rows[0].name, 'Ada')
  assert.equal(out.rows[0].phone, '')
})

test('preserves trailing comma as empty trailing field', () => {
  const out = parseCsv('a,b,c\n1,2,\n')
  assert.equal(out.rows[0].c, '')
})

test('rejects non-string input', () => {
  assert.throws(() => parseCsv(123), TypeError)
})

export const __testing = { parseCsv }
