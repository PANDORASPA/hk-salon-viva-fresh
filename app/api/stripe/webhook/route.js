import { NextResponse } from 'next/server'
import { getServiceClient } from '../../../../lib/supabase/service'
import { verifyWebhook, isStripeMockMode } from '../../../../lib/payments/stripe'

/**
 * POST /api/stripe/webhook
 *
 * Stripe sends the raw body + a `Stripe-Signature` header. We verify the
 * signature (or accept a mock event in dev / staging) and then issue the
 * `user_tickets` row. The `user_tickets.stripe_event_id` column has a
 * UNIQUE constraint so re-delivery of the same webhook is a no-op.
 *
 * The mock variant (when STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are
 * not set) accepts `{ session_id, package_id, customer_id?, customer_name?,
 * customer_phone?, customer_email? }` so the dev flow can still issue a
 * ticket end-to-end.
 */
export async function POST(request) {
  const db = getServiceClient()
  if (!db) {
    return NextResponse.json({ error: 'Supabase service role not configured.' }, { status: 500 })
  }

  let event
  if (isStripeMockMode()) {
    const body = await request.json().catch(() => ({}))
    if (!body.session_id || !body.package_id) {
      return NextResponse.json({ error: 'session_id and package_id required (mock mode).' }, { status: 400 })
    }
    event = await verifyWebhook({ sessionId: body.session_id })
    // Augment the synthetic event with the explicit fields the dev caller
    // supplied — Stripe normally delivers these inside `session.metadata`.
    event.data.object.metadata = {
      package_id: String(body.package_id),
      customer_id: body.customer_id ? String(body.customer_id) : '',
      customer_name: body.customer_name || '',
      customer_phone: body.customer_phone || '',
      customer_email: body.customer_email || '',
    }
    event.data.object.amount_total = body.amount_total ?? 0
  } else {
    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature')
    try {
      event = await verifyWebhook({ rawBody, signature })
    } catch (err) {
      return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 })
    }
  }

  if (event.type !== 'checkout.session.completed') {
    // We only act on completed checkouts; ack the event so Stripe doesn't retry
    return NextResponse.json({ received: true, ignored: event.type }, { status: 200 })
  }

  const session = event.data.object
  const metadata = session.metadata || {}
  const packageId = Number(metadata.package_id)
  if (!Number.isSafeInteger(packageId)) {
    return NextResponse.json({ error: 'session.metadata.package_id missing or invalid.' }, { status: 400 })
  }

  // Look up the package to record price / sessions / validity
  const { data: pkg } = await db
    .from('packages')
    .select('id, name, total_sessions, validity_days, price_hkd')
    .eq('id', packageId)
    .maybeSingle()
  if (!pkg) {
    return NextResponse.json({ error: 'package not found.' }, { status: 404 })
  }

  // Idempotency: insert with UNIQUE(stripe_event_id) constraint. If we get
  // a duplicate-key error the webhook is a re-delivery — ack and exit.
  const totalSessions = Number(metadata.total_sessions) || pkg.total_sessions || 1
  const validityDays = Number(metadata.validity_days) || pkg.validity_days || 365
  const expiresAt = new Date(Date.now() + validityDays * 86_400_000).toISOString()

  const insert = {
    stripe_event_id: event.id,
    package_id: pkg.id,
    customer_id: metadata.customer_id ? Number(metadata.customer_id) : null,
    customer_name: metadata.customer_name || null,
    customer_phone: metadata.customer_phone || null,
    customer_email: metadata.customer_email || null,
    sessions_remaining: totalSessions,
    total_sessions: totalSessions,
    expires_at: expiresAt,
    paid_at: new Date().toISOString(),
    status: 'active',
  }

  const { data, error } = await db
    .from('user_tickets')
    .insert(insert)
    .select()
    .single()

  if (error) {
    if (error.code === '23505' || /duplicate key/i.test(error.message || '')) {
      // Re-delivery of an already-processed event — idempotent no-op
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ received: true, ticketId: data.id, mock: !!event.mock }, { status: 200 })
}
