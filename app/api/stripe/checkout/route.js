import { NextResponse } from 'next/server'
import { getServerClient } from '../../../../lib/supabase/server'
import { getServiceClient } from '../../../../lib/supabase/service'
import { createCheckoutSession } from '../../../../lib/payments/stripe'
import { guardMutationRequest } from '../../../../lib/security/request-guards'

/**
 * GET /api/stripe/checkout?package_id=N[&email=...&name=...]
 *
 * Creates a Stripe Checkout Session (or mock equivalent) for the given
 * package, then 302-redirects the browser to the session URL. In mock mode
 * the URL points back to /packages/success with a fake session id.
 */
export async function GET(request) {
  const url = new URL(request.url)
  const packageId = url.searchParams.get('package_id')
  if (!packageId) {
    return NextResponse.redirect(new URL('/packages?error=missing_package_id', url.origin))
  }

  // Look up the package (service-role so unauthenticated browsers can buy)
  const db = getServiceClient()
  const { data: pkg, error: pkgErr } = await db
    .from('packages')
    .select('id, name, description, total_sessions, validity_days, price_hkd, colour_hex, is_active')
    .eq('id', Number.isFinite(Number(packageId)) ? Number(packageId) : -1)
    .maybeSingle()
  if (pkgErr || !pkg) {
    return NextResponse.redirect(new URL('/packages?error=package_not_found', url.origin))
  }
  if (!pkg.is_active) {
    return NextResponse.redirect(new URL('/packages?error=package_inactive', url.origin))
  }

  // Optional: bind the order to a known customer by email/name
  const email = url.searchParams.get('email') || undefined
  const name = url.searchParams.get('name') || undefined

  const session = await createCheckoutSession({
    package: pkg,
    customerEmail: email,
    customerName: name,
  })

  return NextResponse.redirect(session.url, { status: 303 })
}

/**
 * POST /api/stripe/checkout — same flow but accepts a JSON body for the
 * fetch() callers (used by future client-side React flows).
 */
export async function POST(request) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'stripe.checkout', limit: 30, windowMs: 3_600_000 } })
  if (guard) return guard

  const body = await request.json().catch(() => ({}))
  const packageId = body?.package_id
  if (!packageId) {
    return NextResponse.json({ error: 'package_id required.' }, { status: 400 })
  }
  const db = getServiceClient()
  const { data: pkg, error: pkgErr } = await db
    .from('packages')
    .select('id, name, description, total_sessions, validity_days, price_hkd, colour_hex, is_active')
    .eq('id', Number(packageId))
    .maybeSingle()
  if (pkgErr || !pkg || !pkg.is_active) {
    return NextResponse.json({ error: 'Package not found or inactive.' }, { status: 404 })
  }

  const session = await createCheckoutSession({
    package: pkg,
    customerEmail: body?.customerEmail,
    customerName: body?.customerName,
  })

  return NextResponse.json({ id: session.id, url: session.url, mock: session.mock }, { status: 200 })
}
