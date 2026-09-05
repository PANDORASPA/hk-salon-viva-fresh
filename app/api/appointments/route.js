import { NextResponse } from 'next/server'
import { getServiceClient } from '../../../lib/supabase/service'
import { guardMutationRequest } from '../../../lib/security/request-guards'

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
  const duration = Number(svc?.duration_minutes) || 60
  const endsAt = new Date(start.getTime() + duration * 60_000)

  // If customerPackageId, validate balance
  if (customerPackageId) {
    const { data: cp } = await db.from('customer_packages').select('id,sessions_remaining,is_active,expires_at').eq('id', Number(customerPackageId)).single()
    if (!cp) return NextResponse.json({ error: 'Package not found.' }, { status: 400 })
    if (!cp.is_active || new Date(cp.expires_at) <= new Date() || cp.sessions_remaining < 1) {
      return NextResponse.json({ error: 'This package has no remaining sessions or has expired.' }, { status: 400 })
    }
  }

  // Create appointment (user_id null for non-logged-in bookings)
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

  if (aptErr) return NextResponse.json({ error: aptErr.message }, { status: 500 })

  // Deduct session atomically via RPC
  if (customerPackageId) {
    try {
      await db.rpc('deduct_package_session', { p_customer_package_id: Number(customerPackageId), p_appointment_id: apt.id })
    } catch (_) {}
  }

  return NextResponse.json({ appointment: apt }, { status: 201 })
}
