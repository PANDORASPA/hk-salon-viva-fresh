// Fulfillment must be verified against Auth-owned customer_packages before enabling payments.
export function isStripeConfigured() { return false }
const disabled = () => new Error('網上付款尚未啟用，請聯絡店舖安排購買。')
export async function getStripe() { throw disabled() }
export async function createCheckoutSession({ package: pkg } = {}) {
  if (!pkg?.id) throw new Error('createCheckoutSession: package.id required')
  throw disabled()
}
export async function verifyWebhook() { throw disabled() }
function getEnv() { return { secretKey: process.env.STRIPE_SECRET_KEY, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET, siteUrl: process.env.NEXT_PUBLIC_SITE_URL, currency: 'HKD' } }
export const __testing = { isStripeConfigured, getEnv }
export default { isStripeConfigured, createCheckoutSession, verifyWebhook, getStripe, __testing }
