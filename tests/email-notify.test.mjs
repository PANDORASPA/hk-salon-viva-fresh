import assert from 'node:assert/strict'
import test from 'node:test'

import emailLib from '../lib/notifications/email.js'
const { sendEmail, isEmailLiveMode, __testing } = emailLib

test('isEmailLiveMode is false when RESEND_API_KEY missing', () => {
  assert.equal(isEmailLiveMode(), false)
})

test('sendEmail returns ok=true in dry-run when not configured', async () => {
  const result = await sendEmail({
    to: 'test@example.com',
    subject: 'Hello',
    text: 'Test message',
  })
  assert.equal(result.ok, true)
  assert.equal(result.mode, 'dry-run')
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
