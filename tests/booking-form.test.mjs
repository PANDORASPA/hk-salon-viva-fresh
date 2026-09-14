import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../app/booking/page.js', import.meta.url), 'utf8')

test('booking page renders the authenticated-aware booking wizard', () => {
  assert.match(source, /BookingWizard/)
  assert.match(source, /authenticated=/)
  assert.doesNotMatch(source, /BookingForm/)
})
