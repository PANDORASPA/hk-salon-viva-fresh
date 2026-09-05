import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../../lib/admin/salon-api'

export async function GET(request, { params }) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const id = Number(params.id)
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
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id)) return jsonError('Invalid ID', 400)
  const body = await request.json()
  const allowed = ['name', 'colour_hex', 'description', 'total_sessions', 'validity_days', 'price_hkd', 'is_active']
  const update = {}
  for (const key of allowed) if (body[key] !== undefined) update[key] = body[key]
  const { data, error } = await ctx.db.from('packages').update(update).eq('id', id).select().single()
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'package.update', 'packages', id)
  return NextResponse.json({ package: data })
}

export async function DELETE(request, { params }) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id)) return jsonError('Invalid ID', 400)
  const { error } = await ctx.db.from('packages').delete().eq('id', id)
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'package.delete', 'packages', id)
  return NextResponse.json({ success: true })
}
