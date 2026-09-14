import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../../lib/admin/salon-api'
import { guardMutationRequest } from '../../../../../lib/security/request-guards'
import { applyPackageAdjustment } from '../../../../../lib/admin/package-adjustment'

export async function GET(request, { params }) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id)) return jsonError('Invalid ID', 400)
  const { data, error } = await ctx.db
    .from('customer_packages')
    .select('*, customers(name, phone), packages(name, colour_hex)')
    .eq('id', id)
    .single()
  if (error) return jsonError(error)
  return NextResponse.json({ customerPackage: data })
}

export async function PATCH(request, { params }) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'admin.customer-packages', limit: 30, windowMs: 60_000 } })
  if (guard) return guard
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id)) return jsonError('Invalid ID', 400)
  const body = await request.json()
  if (body.adjustment !== undefined || body.reason !== undefined) {
    try {
      const customerPackage = await applyPackageAdjustment(ctx.db, ctx.auth.user.id, { id, adjustment: body.adjustment, reason: body.reason })
      return NextResponse.json({ customerPackage })
    } catch (error) {
      return jsonError(error, 400)
    }
  }
  const { sessions_remaining, is_active, expires_at } = body
  const update = {}
  if (sessions_remaining !== undefined) update.sessions_remaining = Number(sessions_remaining)
  if (is_active !== undefined) update.is_active = Boolean(is_active)
  if (expires_at !== undefined) update.expires_at = expires_at
  const { data, error } = await ctx.db.from('customer_packages').update(update).eq('id', id).select().single()
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'customer_package.update', 'customer_packages', id)
  return NextResponse.json({ customerPackage: data })
}

export async function DELETE(request, { params }) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'admin.customer-packages', limit: 15, windowMs: 60_000 } })
  if (guard) return guard
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id)) return jsonError('Invalid ID', 400)
  const { error } = await ctx.db.from('customer_packages').delete().eq('id', id)
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'customer_package.delete', 'customer_packages', id)
  return NextResponse.json({ success: true })
}
