import assert from 'node:assert/strict'
import test from 'node:test'

import emailLib from '../lib/notifications/email.js'
const { sendEmail, isEmailLiveMode, __testing } = emailLib

test('isEmailLiveMode is false when RESEND_API_KEY missing', () => {
  assert.equal(isEmailLiveMode(), false)
})

test('sendEmail labels a simulated delivery as dry_run when not configured', async () => {
  const result = await sendEmail({
    to: 'test@example.com',
    subject: 'Hello',
    text: 'Test message',
  })
  assert.equal(result.ok, true)
  assert.equal(result.status, 'dry_run')
})

test('sendEmail returns ok=false when no recipient', async () => {
  const result = await sendEmail({ to: '', subject: 'x', text: 'y' })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'no_recipient')
})

test('sendEmail returns ok=false when content missing', async () => {
  const result = await sendEmail({ to: 'x@y.com', subject: '' })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'missing_content')
})

test('escapeHtml escapes dangerous characters', () => {
  const { escapeHtml } = __testing
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')
  assert.equal(escapeHtml('a & b'), 'a &amp; b')
  assert.equal(escapeHtml('"x"'), '&quot;x&quot;')
})

test('stripHtml removes tags', () => {
  const { stripHtml } = __testing
  assert.equal(stripHtml('<p>hello <b>world</b></p>'), 'hello world')
  assert.equal(stripHtml('<a href="x">link</a>'), 'link')
})

test('provider error reasons are controlled codes and never echo credentials', () => {
  const { sanitizeProviderReason } = __testing
  for (const message of ['api_key=secret-value', 'Authorization: Bearer secret-value', 'token: secret-value', 'key secret-value']) {
    const reason = sanitizeProviderReason(message)
    assert.equal(reason, 'provider_error')
    assert.doesNotMatch(reason, /secret-value|api_key|bearer|token|key/i)
  }
})

test('Resend receives a reminder idempotency key as send options, never as email payload data', async () => {
  // Mutation caught: passing idempotencyKey in the payload silently omits the
  // provider's Idempotency-Key header and allows a retry to duplicate email.
  const calls = []
  const previousKey = process.env.RESEND_API_KEY
  const previousFrom = process.env.NOTIFY_EMAIL_FROM
  process.env.RESEND_API_KEY = 're_test'
  process.env.NOTIFY_EMAIL_FROM = 'studio@example.test'
  __testing.setResendClient({ emails: { send: async (...args) => (calls.push(args), { data: { id: 'provider-1' } }) } })
  try {
    const result = await sendEmail({ to: 'guest@example.test', subject: 'Reminder', text: 'Tomorrow', idempotencyKey: 'reminder:9:24' })
    assert.deepEqual(result, { ok: true, status: 'sent', id: 'provider-1' })
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0].idempotencyKey, undefined)
    assert.deepEqual(calls[0][1], { idempotencyKey: 'reminder:9:24' })
  } finally {
    __testing.setResendClient(null)
    if (previousKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = previousKey
    if (previousFrom === undefined) delete process.env.NOTIFY_EMAIL_FROM
    else process.env.NOTIFY_EMAIL_FROM = previousFrom
  }
})

test('Resend omits send options when no idempotency key is supplied', async () => {
  const calls = []
  const previousKey = process.env.RESEND_API_KEY
  const previousFrom = process.env.NOTIFY_EMAIL_FROM
  process.env.RESEND_API_KEY = 're_test'
  process.env.NOTIFY_EMAIL_FROM = 'studio@example.test'
  __testing.setResendClient({ emails: { send: async (...args) => (calls.push(args), { data: { id: 'provider-2' } }) } })
  try {
    await sendEmail({ to: 'guest@example.test', subject: 'Confirmation', text: 'Booked' })
    assert.equal(calls[0].length, 1)
  } finally {
    __testing.setResendClient(null)
    if (previousKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = previousKey
    if (previousFrom === undefined) delete process.env.NOTIFY_EMAIL_FROM
    else process.env.NOTIFY_EMAIL_FROM = previousFrom
  }
})
