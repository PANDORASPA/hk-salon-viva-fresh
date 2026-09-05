import { NextResponse } from 'next/server'
import availabilityModule from '../../../lib/booking/salon-availability'
import { getServiceClient } from '../../../lib/supabase/service'
const { buildAvailability, londonDateWindow } = availabilityModule

export async function GET(request) {
  const { searchParams } = new URL(request.url), date = searchParams.get('date'), serviceId = Number(searchParams.get('serviceId'))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isSafeInteger(serviceId) || serviceId < 1) return NextResponse.json({ error:'Invalid date or service.' },{ status:400 })
  const db = getServiceClient(), weekday = new Date(`${date}T12:00:00Z`).getUTCDay(), window=londonDateWindow(date)
  const [serviceRes,hoursRes,blockRes,appointmentsRes] = await Promise.all([
    db.from('services').select('duration_minutes').eq('id',serviceId).eq('published',true).maybeSingle(),
    db.from('business_hours').select('*').eq('weekday',weekday).maybeSingle(),
    db.from('blocked_dates').select('id').lte('starts_on',date).gte('ends_on',date).limit(1),
    db.from('appointments').select('starts_at,ends_at,status').neq('status','cancelled').gte('starts_at',window.start.toISOString()).lt('starts_at',window.end.toISOString()),
  ])
  const error = serviceRes.error || hoursRes.error || blockRes.error || appointmentsRes.error
  if (error || !serviceRes.data) return NextResponse.json({ error:'Availability is temporarily unavailable.' },{ status:503 })
  return NextResponse.json({ date, serviceId, slots: buildAvailability({ date, durationMinutes:serviceRes.data.duration_minutes, hours:hoursRes.data, blocked:Boolean(blockRes.data?.length), appointments:appointmentsRes.data || [] }) })
}
