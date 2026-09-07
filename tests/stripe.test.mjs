import assert from 'node:assert/strict'
import test from 'node:test'

import stripeLib from '../lib/payments/stripe.js'
const { isStripeMockMode, createCheckoutSession, verifyWebhook, __testing } = stripeLib

test('isStripeMockMode is true when STRIPE_SECRET_KEY is missing', () => {
  // The test runner has no env set
  assert.equal(isStripeMockMode(), true)
})

test('createCheckoutSession returns a mock session with site URL + package id', async () => {
  const pkg = { id: 7, name: '爆毛術 5 次', total_sessions: 5, validity_days: 365, price_hkd: 3800 }
  const session = await createCheckoutSession({ package: pkg })
  assert.equal(session.mock, true)
  assert.match(session.id, /^cs_mock_/)
  assert.match(session.url, /\/packages\/success/)
  assert.match(session.url, /session_id=cs_mock_/)
  assert.match(session.url, /package_id=7/)
})

test('createCheckoutSession includes email in mock URL when provided', async () => {
  const pkg = { id: 8, name: 'Test', total_sessions: 3, validity_days: 180, price_hkd: 1500 }
  const session = await createCheckoutSession({ package: pkg, customerEmail: 'ada@example.com' })
  assert.match(session.url, /email=ada%40example\.com/)
})

test('createCheckoutSession throws when package.id missing', async () => {
  await assert.rejects(() => createCheckoutSession({ package: {} }), /package\.id required/)
})

test('verifyWebhook in mock mode returns a synthetic checkout.session.completed event', async () => {
  const event = await verifyWebhook({ sessionId: 'cs_mock_abc' })
  assert.equal(event.type, 'checkout.session.completed')
  assert.equal(event.mock, true)
  assert.equal(event.data.object.id, 'cs_mock_abc')
  assert.equal(event.data.object.payment_status, 'paid')
})

test('verifyWebhook(mock) requires sessionId', async () => {
  await assert.rejects(() => verifyWebhook({}), /sessionId required/)
})

test('__testing exports stable shape', () => {
  assert.equal(typeof __testing.isStripeMockMode, 'function')
  assert.equal(typeof __testing.getEnv, 'function')
  const env = __testing.getEnv()
  assert.ok('secretKey' in env)
  assert.ok('webhookSecret' in env)
  assert.ok('siteUrl' in env)
  assert.ok('currency' in env)
})
