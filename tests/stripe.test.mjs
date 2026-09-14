import assert from 'node:assert/strict'
import test from 'node:test'

import stripeLib from '../lib/payments/stripe.js'
const { isStripeConfigured, createCheckoutSession, verifyWebhook, __testing } = stripeLib

test('Stripe purchase capability is disabled when live/test credentials are absent', () => {
  assert.equal(isStripeConfigured(), false)
})

test('createCheckoutSession never fabricates a paid checkout when credentials are absent', async () => {
  const pkg = { id: 7, name: '爆毛術 5 次', total_sessions: 5, validity_days: 365, price_hkd: 3800 }
  await assert.rejects(() => createCheckoutSession({ package: pkg }), /未啟用|not configured/i)
})

test('createCheckoutSession throws when package.id missing', async () => {
  await assert.rejects(() => createCheckoutSession({ package: {} }), /package\.id required/)
})

test('verifyWebhook rejects when Stripe is not configured', async () => {
  await assert.rejects(() => verifyWebhook({}), /未啟用|not configured/i)
})

test('__testing exports stable shape', () => {
  assert.equal(typeof __testing.isStripeConfigured, 'function')
  assert.equal(typeof __testing.getEnv, 'function')
  const env = __testing.getEnv()
  assert.ok('secretKey' in env)
  assert.ok('webhookSecret' in env)
  assert.ok('siteUrl' in env)
  assert.ok('currency' in env)
})
