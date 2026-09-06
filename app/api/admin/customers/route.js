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

export async function DELETE(request) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id'))
  if (!Number.isSafeInteger(id)) return jsonError('Invalid customer ID.', 400)
  // Don't delete if has active appointments in future
  const { data: futureAppts } = await ctx.db
    .from('appointments')
    .select('id')
    .eq('customer_id', id)
    .neq('status', 'cancelled')
    .gte('starts_at', new Date().toISOString())
    .limit(1)
  if (futureAppts?.length > 0) return jsonError('無法刪除：該客戶有未來的預約記錄。', 400)
  const { error } = await ctx.db.from('customers').delete().eq('id', id)
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'customer.delete', 'customers', id)
  return NextResponse.json({ success: true })
}
