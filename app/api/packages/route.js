import { NextResponse } from 'next/server'
import { getServiceClient } from '../../../lib/supabase/service'

export async function GET() {
  const db = getServiceClient()
  const { data, error } = await db
    .from('packages')
    .select('id, name, colour_hex, description, total_sessions, validity_days, price_hkd, package_services(service_id, services(id, name, duration_minutes))')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ packages: data || [] })
}
