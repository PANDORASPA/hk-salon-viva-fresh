import { NextResponse } from 'next/server'
import { getServiceClient } from '../../../lib/supabase/service'
import { guardMutationRequest } from '../../../lib/security/request-guards'
import { applyRedemption, isCustomerPackageUsable } from '../../../lib/booking/package-usage'

export async function POST(request) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'booking', limit: 10, windowMs: 3_600_000 } })
  if (guard) return guard
  const body = await request.json()
  const { serviceId, customerName, customerPhone, customerEmail, startsAt, customerId, customerPackageId } = body

  if (!serviceId || !customerName?.trim() || !customerPhone?.trim() || !startsAt) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }
  if (!Number.isSafeInteger(Number(serviceId))) {
    return NextResponse.json({ error: 'Invalid service.' }, { status: 400 })
  }
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime()) || start <= new Date()) {
    return NextResponse.json({ error: 'Invalid or past booking time.' }, { status: 400 })
  }

  const db = getServiceClient()

  // Get service duration
  const { data: svc } = await db.from('services').select('duration_minutes').eq('id', Number(serviceId)).single()
  if (!svc) {
    return NextResponse.json({ error: 'Service not found.' }, { status: 404 })
  }
  const duration = Number(svc.duration_minutes) || 60
  const endsAt = new Date(start.getTime() + duration * 60_000)

  // If customerPackageId, validate it (defence in depth — UI filters but we must not trust it)
  if (customerPackageId) {
    if (!Number.isSafeInteger(Number(customerPackageId))) {
      return NextResponse.json({ error: 'Invalid package id.' }, { status: 400 })
    }
    const { data: cp } = await db
      .from('customer_packages')
      .select('id, sessions_remaining, is_active, expires_at, customer_id')
      .eq('id', Number(customerPackageId))
      .single()
    if (!cp) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 400 })
    }
    if (customerId && cp.customer_id && Number(cp.customer_id) !== Number(customerId)) {
      return NextResponse.json({ error: 'This package does not belong to the specified customer.' }, { status: 403 })
    }
    if (!isCustomerPackageUsable(cp)) {
      return NextResponse.json({ error: 'This package has no remaining sessions or has expired.' }, { status: 400 })
    }
  }

  // Create appointment
  const { data: apt, error: aptErr } = await db.from('appointments').insert({
    user_id: null,
    service_id: Number(serviceId),
    customer_id: customerId ? Number(customerId) : null,
    customer_package_id: customerPackageId ? Number(customerPackageId) : null,
    customer_name: customerName.trim(),
    customer_phone: customerPhone.trim(),
    customer_email: customerEmail?.trim() || null,
    starts_at: start.toISOString(),
    ends_at: endsAt.toISOString(),
    status: 'pending',
  }).select().single()

  if (aptErr) {
    return NextResponse.json({ error: aptErr.message }, { status: 500 })
  }

  // Atomic redemption via lib/booking/package-usage (RPC with legacy fallback)
  if (customerPackageId) {
    const result = await applyRedemption(db, {
      customerPackageId: Number(customerPackageId),
      appointmentId: apt.id,
    })
    if (!result.ok) {
      // Roll back the appointment we just inserted
      await db.from('appointments').delete().eq('id', apt.id)
      const reason = result.reason || 'redemption_failed'
      const message =
        reason === 'not_usable' ? 'This package has no remaining sessions or has expired.' :
        reason === 'customer_mismatch' ? 'This package does not belong to the specified customer.' :
        reason === 'package_lookup_failed' ? 'Package not found.' :
        'Package redemption failed; booking was rolled back.'
      return NextResponse.json({ error: message, reason }, { status: 400 })
    }
  }

  return NextResponse.json({ appointment: apt }, { status: 201 })
}
