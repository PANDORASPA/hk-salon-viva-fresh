import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../lib/admin/salon-api'

export async function GET() {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const { data, error } = await ctx.db
    .from('packages')
    .select('*, package_services(service_id, services(name))')
    .order('created_at', { ascending: false })
  if (error) return jsonError(error)
  return NextResponse.json({ packages: data || [] })
}

export async function POST(request) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const body = await request.json()
  const { name, colour_hex, description, total_sessions, validity_days, price_hkd } = body
  if (!name || !total_sessions) return jsonError('name and total_sessions required', 400)
  const { data, error } = await ctx.db
    .from('packages')
    .insert({
      name: String(name).trim(),
      colour_hex: colour_hex || '#a98152',
      description: description || null,
      total_sessions: Number(total_sessions),
      validity_days: Number(validity_days) || 365,
      price_hkd: Number(price_hkd) || 0,
    })
    .select()
    .single()
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'package.create', 'packages', data.id)
  return NextResponse.json({ package: data }, { status: 201 })
}
