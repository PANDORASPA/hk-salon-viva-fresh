import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../lib/admin/salon-api'
import { guardMutationRequest } from '../../../../lib/security/request-guards'
import { validateAppointmentInput } from '../../../../lib/validation/salon'

export async function GET() {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const { data, error } = await ctx.db
    .from('appointments')
    .select('*, services(name,price,duration_minutes), customer_id, customer_package_id, customers(name,phone), customer_packages(sessions_remaining, total_sessions, packages(name,colour_hex))')
    .order('starts_at', { ascending: false })
    .limit(500)
  return error ? jsonError(error) : NextResponse.json({ appointments: data || [] })
}

export async function PATCH(request) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'admin.appointments', limit: 60, windowMs: 60_000 } })
  if (guard) return guard
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const body = await request.json()
  const id = Number(body.id)
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show']
  if (!Number.isSafeInteger(id) || !allowed.includes(body.status)) return jsonError('Invalid update.', 400)
  const update = {
    status: body.status,
    admin_notes: String(body.adminNotes || '').slice(0, 2000),
    customer_id: body.customerId ? Number(body.customerId) : undefined,
    customer_package_id: body.customerPackageId ? Number(body.customerPackageId) : undefined,
  }
  if (body.startsAt) {
    const start = new Date(body.startsAt)
    if (Number.isNaN(start.getTime())) return jsonError('Invalid start time.', 400)
    const { data: svc } = await ctx.db.from('appointments').select('services(duration_minutes)').eq('id', id).single()
    update.starts_at = start.toISOString()
    update.ends_at = new Date(start.getTime() + Number(svc?.services?.duration_minutes || 60) * 60000).toISOString()
  }
  // Remove undefined values
  Object.keys(update).forEach(k => update[k] === undefined && delete update[k])
  const { data, error } = await ctx.db.from('appointments').update(update).eq('id', id).select().single()
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'appointment.update', 'appointments', id, { status: update.status })
  return NextResponse.json({ appointment: data })
}
