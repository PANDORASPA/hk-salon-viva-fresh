import { NextResponse } from 'next/server'
import { getServiceClient } from '../../../lib/supabase/service'

export async function PATCH(request, { params }) {
  const id = Number(params.id)
  if (!Number.isSafeInteger(id)) {
    return NextResponse.json({ error: 'Invalid appointment ID.' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const { phone, customerId, action } = body

  if (!phone?.trim()) {
    return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 })
  }

  const db = getServiceClient()

  // Verify appointment belongs to this customer
  const { data: appt, error: apptErr } = await db
    .from('appointments')
    .select('id, status, customer_phone, customer_id, customer_package_id')
    .eq('id', id)
    .single()

  if (apptErr || !appt) {
    return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 })
  }

  // Phone match required (customer_id match is stronger)
  const phoneMatch = appt.customer_phone?.replace(/\s|-/g, '') === phone.replace(/\s|-/g, '')
  const idMatch = customerId && appt.customer_id === Number(customerId)

  if (!phoneMatch && !idMatch) {
    return NextResponse.json({ error: '此預約並非以你的電話預約，無法操作。' }, { status: 403 })
  }

  // Only pending/confirmed can be cancelled by customer
  if (action === 'cancel') {
    if (!['pending', 'confirmed'].includes(appt.status)) {
      return NextResponse.json({ error: '此預約狀態不允許取消。' }, { status: 400 })
    }

    const { error: updateErr } = await db
      .from('appointments')
      .update({ status: 'cancelled', admin_notes: 'Cancelled by customer' })
      .eq('id', id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Restore package session
    if (appt.customer_package_id) {
      await db.rpc('add_package_session', { p_customer_package_id: appt.customer_package_id })
    }

    return NextResponse.json({ success: true, message: '預約已成功取消。' })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
