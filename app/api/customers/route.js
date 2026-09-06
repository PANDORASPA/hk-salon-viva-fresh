import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')
  if (!phone) return NextResponse.json({ customers: [] })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase not configured.' }, { status: 500 })
  }
  const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const [customerRes, apptRes] = await Promise.all([
    db
      .from('customers')
      .select('id, name, phone, email, customer_packages(id, sessions_remaining, total_sessions, is_active, expires_at, packages(name, colour_hex, package_services(service_id)))')
      .eq('phone', phone.trim())
      .limit(5),
    db
      .from('appointments')
      .select('id, starts_at, status, service_id, services(name, duration_minutes), customer_packages(packages(name))')
      .eq('customer_phone', phone.trim())
      .in('status', ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'])
      .gte('starts_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('starts_at', { ascending: false })
      .limit(20),
  ])

  if (customerRes.error) return NextResponse.json({ error: customerRes.error.message }, { status: 500 })

  const customers = customerRes.data || []
  // Attach appointments to first matching customer
  if (customers.length > 0 && apptRes.data) {
    customers[0]._appointments = apptRes.data
  }

  return NextResponse.json({ customers })
}
