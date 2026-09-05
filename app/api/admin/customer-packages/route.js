import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../lib/admin/salon-api'

export async function GET() {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const { data, error } = await ctx.db
    .from('customer_packages')
    .select('*, customers(name, phone), packages(name, colour_hex)')
    .order('purchased_at', { ascending: false })
    .limit(500)
  if (error) return jsonError(error)
  return NextResponse.json({ customerPackages: data || [] })
}

export async function POST(request) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const body = await request.json()
  const { customer_id, package_id, total_sessions, expires_at } = body
  if (!customer_id || !package_id || !total_sessions) return jsonError('customer_id, package_id, total_sessions required', 400)
  const exp = expires_at || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await ctx.db
    .from('customer_packages')
    .insert({
      customer_id: Number(customer_id),
      package_id: Number(package_id),
      total_sessions: Number(total_sessions),
      sessions_remaining: Number(total_sessions),
      expires_at: exp,
    })
    .select()
    .single()
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'customer_package.create', 'customer_packages', data.id)
  return NextResponse.json({ customerPackage: data }, { status: 201 })
}
