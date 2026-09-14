import { guardMutationRequest } from '../../../../lib/security/request-guards.js'
export async function GET(request) {
  return Response.redirect(new URL('/packages?error=payments_unavailable', request.url), 303)
}
export async function POST(request) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'stripe.checkout', limit: 30, windowMs: 3_600_000 } })
  return guard || Response.json({ error: 'payments_unavailable', message: '網上付款尚未啟用。' }, { status: 503 })
}
