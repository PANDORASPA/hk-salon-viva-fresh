/**
 * Stripe wrapper with a deterministic mock fallback.
 *
 * Live mode is enabled when BOTH `STRIPE_SECRET_KEY` and
 * `STRIPE_WEBHOOK_SECRET` are set in the environment. Otherwise we use the
 * mock so the build / staging environment can still exercise the full
 * booking + package loop end-to-end without burning Stripe quota or
 * requiring real card details.
 *
 * Mock mode:
 *   - `createCheckoutSession()` returns `{ id: 'cs_mock_<rand>', url: '/packages/success?session_id=...', mock: true }`
 *   - `verifyWebhook()` returns a synthetic event for the given session id
 *   - `isMockMode` is true
 *
 * Switching to live mode is a one-time ops task: provision Stripe products
 * matching each `packages` row (name + `price_hkd` * 100 cents), set the
 * four env vars (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
 * STRIPE_CURRENCY), and the same code path runs against real Stripe.
 */

import { randomBytes } from 'node:crypto'

let stripeClient = null
let mockMode = null

function getEnv() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    currency: process.env.STRIPE_CURRENCY || 'HKD',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  }
}

export function isStripeMockMode() {
  if (mockMode !== null) return mockMode
  const env = getEnv()
  mockMode = !env.secretKey || !env.webhookSecret
  return mockMode
}

export async function getStripe() {
  if (stripeClient) return stripeClient
  if (isStripeMockMode()) return null
  const env = getEnv()
  // Dynamic import so the optional dep is not required in mock mode.
  // Build-time resolution: if 'stripe' is not installed we still want the
  // bundle to compile, so we wrap the import in a try/catch and let live
  // mode fail with a clear error at the first call site.
  let Stripe
  try {
    const mod = await import('stripe')
    Stripe = mod.default || mod
  } catch (err) {
    throw new Error(
      'Stripe SDK is not installed. Run `npm install stripe` to enable live mode, ' +
      'or set STRIPE_SECRET_KEY="" / unset to keep using mock mode.',
    )
  }
  stripeClient = new Stripe(env.secretKey, { apiVersion: '2024-06-20' })
  return stripeClient
}

/**
 * Create a Checkout Session for a package purchase.
 *
 * @param {object} args
 * @param {object} args.package  { id, name, price_hkd, total_sessions, validity_days }
 * @param {string} [args.customerEmail]
 * @param {string} [args.customerName]
 * @param {string} [args.successPath]  Override the success redirect (default: /packages/success)
 * @param {string} [args.cancelPath]   Override the cancel redirect (default: /packages)
 * @returns {Promise<{ id, url, mock: boolean }>}
 */
export async function createCheckoutSession({ package: pkg, customerEmail, customerName, successPath, cancelPath } = {}) {
  if (!pkg || !pkg.id) throw new Error('createCheckoutSession: package.id required')
  const env = getEnv()
  if (isStripeMockMode()) {
    const id = `cs_mock_${randomBytes(12).toString('hex')}`
    const url = `${env.siteUrl}${successPath || '/packages/success'}?session_id=${id}&package_id=${pkg.id}${customerEmail ? `&email=${encodeURIComponent(customerEmail)}` : ''}`
    return { id, url, mock: true }
  }
  const stripe = await getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: env.currency.toLowerCase(),
          product_data: { name: pkg.name, metadata: { package_id: String(pkg.id) } },
          unit_amount: Math.round(Number(pkg.price_hkd || 0) * 100),
        },
        quantity: 1,
      },
    ],
    customer_email: customerEmail,
    success_url: `${env.siteUrl}${successPath || '/packages/success'}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.siteUrl}${cancelPath || '/packages'}`,
    metadata: {
      package_id: String(pkg.id),
      package_name: String(pkg.name || ''),
      total_sessions: String(pkg.total_sessions || 0),
      validity_days: String(pkg.validity_days || 0),
      customer_name: String(customerName || ''),
    },
  })
  return { id: session.id, url: session.url, mock: false }
}

/**
 * Verify a webhook signature and parse the event. In mock mode we
 * construct a synthetic `checkout.session.completed` event from the
 * session_id so dev / staging can run the full loop.
 *
 * @param {string} rawBody  The raw request body (NOT JSON-parsed)
 * @param {string|null} signature  The `Stripe-Signature` header
 * @returns {Promise<object>}     The parsed event
 */
export async function verifyWebhook({ rawBody, signature, sessionId }) {
  if (isStripeMockMode()) {
    if (!sessionId) throw new Error('verifyWebhook(mock): sessionId required')
    return {
      id: `evt_mock_${randomBytes(10).toString('hex')}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          payment_status: 'paid',
          amount_total: 0,
          currency: 'hkd',
          metadata: {},
        },
      },
      mock: true,
    }
  }
  const stripe = await getStripe()
  const env = getEnv()
  // For real Stripe the raw body must be passed as a string or Buffer
  return stripe.webhooks.constructEvent(rawBody, signature, env.webhookSecret)
}

export const __testing = { isStripeMockMode, getEnv }

export default { isStripeMockMode, createCheckoutSession, verifyWebhook, getStripe, __testing }
