import { NextResponse } from 'next/server'
import { getServiceClient } from '../../../lib/supabase/service'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')
  if (!phone) return NextResponse.json({ customers: [] })
  const db = getServiceClient()
  const { data, error } = await db
    .from('customers')
    .select('id, name, phone, email, customer_packages(id, sessions_remaining, total_sessions, is_active, expires_at, packages(name, colour_hex))')
    .eq('phone', phone.trim())
    .limit(5)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ customers: data || [] })
}
