import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../lib/admin/salon-api'

export async function GET() {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const { data, error } = await ctx.db
    .from('customers')
    .select('*, customer_packages(count)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return jsonError(error)
  return NextResponse.json({ customers: data || [] })
}

export async function POST(request) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const body = await request.json()
  const { name, phone, email, notes } = body
  if (!name || !phone) return jsonError('name and phone are required.', 400)
  const { data, error } = await ctx.db
    .from('customers')
    .insert({ name: String(name).trim(), phone: String(phone).trim(), email: email || null, notes: notes || null })
    .select()
    .single()
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'customer.create', 'customers', data.id)
  return NextResponse.json({ customer: data }, { status: 201 })
}
