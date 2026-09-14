import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../../lib/admin/salon-api'
import { guardMutationRequest } from '../../../../../lib/security/request-guards'

export async function GET(request, { params }) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id)) return jsonError('Invalid ID', 400)
  const { data, error } = await ctx.db
    .from('customers')
    .select('*, appointments(id, reference, starts_at, status), customer_packages(id, package_id, total_sessions, sessions_remaining, is_active, expires_at, packages(name, colour_hex), package_redemptions(id, redeemed_at, refunded_at))')
    .eq('id', id)
    .single()
  if (error) return jsonError(error)
  return NextResponse.json({ customer: data })
}

export async function PATCH(request, { params }) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'admin.customers', limit: 30, windowMs: 60_000 } })
  if (guard) return guard
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id)) return jsonError('Invalid ID', 400)
  const body = await request.json()
  const { name, phone, email, notes } = body
  const update = {}
  if (name !== undefined) update.name = String(name).trim()
  if (phone !== undefined) update.phone = String(phone).trim()
  if (email !== undefined) update.email = email || null
  if (notes !== undefined) update.notes = notes || null
  update.updated_at = new Date().toISOString()
  const { data, error } = await ctx.db.from('customers').update(update).eq('id', id).select().single()
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'customer.update', 'customers', id)
  return NextResponse.json({ customer: data })
}

export async function DELETE(request, { params }) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'admin.customers', limit: 15, windowMs: 60_000 } })
  if (guard) return guard
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id)) return jsonError('Invalid ID', 400)
  const { error } = await ctx.db.from('customers').delete().eq('id', id)
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'customer.delete', 'customers', id)
  return NextResponse.json({ success: true })
}
