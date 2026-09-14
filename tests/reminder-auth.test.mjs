import assert from 'node:assert/strict'
import test from 'node:test'

import { __testing } from '../app/api/cron/reminders/route.js'

test('cron accepts the official bearer secret and rejects missing or wrong credentials', () => {
  const secret = 'cron-test-secret'
  assert.equal(__testing.isAuthorizedCronRequest(new Request('https://salon.test/api/cron/reminders', { headers: { authorization: `Bearer ${secret}` } }), secret), true)
  assert.equal(__testing.isAuthorizedCronRequest(new Request('https://salon.test/api/cron/reminders'), secret), false)
  assert.equal(__testing.isAuthorizedCronRequest(new Request('https://salon.test/api/cron/reminders', { headers: { authorization: 'Bearer wrong' } }), secret), false)
})

test('cron retains the documented legacy query secret only as a compatibility fallback', () => {
  assert.equal(__testing.isAuthorizedCronRequest(new Request('https://salon.test/api/cron/reminders?secret=cron-test-secret'), 'cron-test-secret'), true)
})
