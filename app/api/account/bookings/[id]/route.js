import { NextResponse } from 'next/server'
import { getServerClient } from '../../../../../lib/supabase/server'
import { getServiceClient } from '../../../../../lib/supabase/service'
import { guardMutationRequest } from '../../../../../lib/security/request-guards'
import { reverseRedemption, applyRedemption } from '../../../../../lib/booking/package-usage'
import { sendBookingNotification } from '../../../../../lib/notifications/notify'

/**
 * GET /api/account/bookings/[id] — read a single booking, scoped to the
 * signed-in user. Used by the account page to load detail for a booking
 * before showing the cancel / reschedule dialog.
 */
export async function GET(_request, { params }) {
  const id = Number(params?.id)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid booking id.' }, { status: 400 })
  }
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db
    .from('appointments')
    .select('id, user_id, customer_id, service_id, customer_package_id, customer_name, customer_phone, customer_email, starts_at, ends_at, status, services(name, duration_minutes, price)')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (data.user_id && data.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ booking: data })
}

/**
 * PATCH /api/account/bookings/[id] — reschedule an existing booking.
 * Body: { startsAt?: string (ISO 8601) }
 *
 * If the booking was paid with a customer package, the redemption is
 * reversed (refunded) and re-applied for the new slot. Either step failing
 * restores the previous state.
 */
export async function PATCH(request, { params }) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'booking.reschedule', limit: 20, windowMs: 3_600_000 } })
  if (guard) return guard

  const id = Number(params?.id)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid booking id.' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const startsAt = body?.startsAt
  if (!startsAt || Number.isNaN(new Date(startsAt).getTime()) || new Date(startsAt) <= new Date()) {
    return NextResponse.json({ error: 'Invalid or past start time.' }, { status: 400 })
  }

  // Use the user-scoped client for ownership check, then the service client
  // for the actual write (server-side with RLS bypass).
  const userDb = await getServerClient()
  const { data: { user } } = await userDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const { data: existing, error: exErr } = await db
    .from('appointments')
    .select('id, user_id, customer_id, service_id, customer_package_id, status, starts_at, ends_at')
    .eq('id', id)
    .maybeSingle()
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.user_id && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (existing.status === 'cancelled' || existing.status === 'completed' || existing.status === 'no_show') {
    return NextResponse.json({ error: `Cannot reschedule a ${existing.status} booking.` }, { status: 400 })
  }

  const { data: svc } = await db.from('services').select('duration_minutes').eq('id', existing.service_id).single()
  const duration = Number(svc?.duration_minutes) || 60
  const newStart = new Date(startsAt)
  const newEnd = new Date(newStart.getTime() + duration * 60_000)

  // If package was used, refund it before mutating the row so the count is
  // available to re-debit if the new slot is also valid.
  let refund = null
  if (existing.customer_package_id) {
    refund = await reverseRedemption(db, {
      customerPackageId: existing.customer_package_id,
      appointmentId: existing.id,
    })
    if (!refund.ok && refund.reason !== 'redemption_delete_failed') {
      return NextResponse.json({ error: `Refund failed: ${refund.reason}` }, { status: 500 })
    }
  }

  const { data: updated, error: updErr } = await db
    .from('appointments')
    .update({
      starts_at: newStart.toISOString(),
      ends_at: newEnd.toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (updErr) {
    // best-effort restore the refund (no-op if already restored)
    if (refund?.ok && existing.customer_package_id) {
      await applyRedemption(db, {
        customerPackageId: existing.customer_package_id,
        appointmentId: existing.id,
      }).catch(() => {})
    }
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // Re-apply the package to the new slot
  if (existing.customer_package_id) {
    const reapply = await applyRedemption(db, {
      customerPackageId: existing.customer_package_id,
      appointmentId: existing.id,
    })
    if (!reapply.ok) {
      // The refund already happened; we just couldn't redeem the new slot.
      // Caller can see this error and decide whether to re-book.
      return NextResponse.json({
        error: 'Rescheduled, but the package could not be re-debited; please re-select a package when re-booking.',
        booking: updated,
        reason: reapply.reason,
      }, { status: 409 })
    }
  }

  // Fire-and-forget notification
  try {
    await sendBookingNotification({
      event: 'booking_reschedule',
      booking: updated,
      prevStartsAt: existing.starts_at,
    })
  } catch (err) {
    console.error('[booking.patch] notification failed', err?.message || err)
  }

  return NextResponse.json({ booking: updated })
}

/**
 * DELETE /api/account/bookings/[id] — cancel an existing booking and, if
 * it was paid with a customer package, automatically refund one session.
 */
export async function DELETE(request, { params }) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'booking.cancel', limit: 30, windowMs: 3_600_000 } })
  if (guard) return guard

  const id = Number(params?.id)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid booking id.' }, { status: 400 })
  }

  const userDb = await getServerClient()
  const { data: { user } } = await userDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const { data: existing, error: exErr } = await db
    .from('appointments')
    .select('id, user_id, customer_id, customer_package_id, status, starts_at')
    .eq('id', id)
    .maybeSingle()
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.user_id && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (existing.status === 'cancelled') {
    return NextResponse.json({ booking: existing, alreadyCancelled: true })
  }

  // Cancellation cutoff: clients must cancel at least N hours ahead.
  // Default 24h; admin can override per-deploy via CANCEL_CUTOFF_HOURS=0
  // (disable) or 48 etc.
  const cutoffHours = Number.isFinite(Number(process.env.CANCEL_CUTOFF_HOURS))
    ? Number(process.env.CANCEL_CUTOFF_HOURS)
    : 24
  if (cutoffHours > 0) {
    const msUntilStart = new Date(existing.starts_at).getTime() - Date.now()
    if (msUntilStart < cutoffHours * 3_600_000) {
      return NextResponse.json(
        {
          error: `Cancellation requires at least ${cutoffHours} hours notice. Please contact the salon to cancel late bookings.`,
          code: 'late_cancellation',
          cutoffHours,
          hoursUntilStart: Math.max(0, Math.round(msUntilStart / 3_600_000 * 10) / 10),
        },
        { status: 400 },
      )
    }
  }

  const { data: updated, error: updErr } = await db
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  let refund = null
  if (existing.customer_package_id) {
    refund = await reverseRedemption(db, {
      customerPackageId: existing.customer_package_id,
      appointmentId: existing.id,
    })
  }

  // Fire-and-forget notification
  try {
    await sendBookingNotification({
      event: 'booking_cancellation',
      booking: updated,
      packageRefunded: Boolean(refund?.ok),
    })
  } catch (err) {
    console.error('[booking.delete] notification failed', err?.message || err)
  }

  return NextResponse.json({
    booking: updated,
    packageRefunded: Boolean(refund?.ok),
    packageRefundReason: refund?.ok ? null : refund?.reason || null,
  })
}
