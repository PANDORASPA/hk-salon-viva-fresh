import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../../lib/admin/salon-api'
import { guardMutationRequest } from '../../../../../lib/security/request-guards'

export async function GET(request, { params }) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isSafeInteger(id)) return jsonError('Invalid ID', 400)
  const { data, error } = await ctx.db
    .from('packages')
    .select('*, package_services(service_id, services(name, id))')
    .eq('id', id)
    .single()
  if (error) return jsonError(error)
  return NextResponse.json({ package: data })
}

export async function PATCH(request, { params }) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'admin.packages', limit: 30, windowMs: 60_000 } })
  if (guard) return guard
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isSafeInteger(id)) return jsonError('Invalid ID', 400)
  const body = await request.json()
  const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds.map(Number) : []
  const { data, error } = await ctx.db.rpc('admin_save_package', { p_actor_id: ctx.auth.user.id, p_package_id: id, p_name: String(body.name || '').trim(), p_colour_hex: String(body.colour_hex || '#a98152'), p_description: String(body.description || ''), p_total_sessions: Number(body.total_sessions), p_validity_days: Number(body.validity_days), p_price_hkd: Number(body.price_hkd), p_service_ids: serviceIds })
  if (error) return jsonError(error, 400)
  return NextResponse.json({ package: data })
}

export async function DELETE(request, { params }) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'admin.packages', limit: 15, windowMs: 60_000 } })
  if (guard) return guard
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isSafeInteger(id)) return jsonError('Invalid ID', 400)
  const { error } = await ctx.db.from('packages').delete().eq('id', id)
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'package.delete', 'packages', id)
  return NextResponse.json({ success: true })
}
