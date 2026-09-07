import { NextResponse } from 'next/server'
import { getServerClient } from '../../../../../lib/supabase/server'
import { buildIcs } from '../../../../../lib/format'

export async function GET(_request, { params }) {
  const id = Number(params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    return new NextResponse('Invalid appointment id', { status: 400 })
  }
  const db = await getServerClient()
  const { data, error } = await db
    .from('appointments')
    .select('id, starts_at, customer_name, services(name, duration_minutes)')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) {
    return new NextResponse('Appointment not found', { status: 404 })
  }
  const ics = buildIcs({
    uid: `appt-${data.id}`,
    summary: `SALON POKE BY VIVA · ${data.services?.name || '預約'}`,
    description: `預約 #${data.id}（${data.customer_name || ''}）`,
    location: 'SALON POKE BY VIVA',
    startsAt: data.starts_at,
    durationMinutes: data.services?.duration_minutes || 60,
  })
  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="salon-poke-${data.id}.ics"`,
    },
  })
}
