import { NextResponse } from 'next/server.js'
import { adminContext, audit, jsonError } from '../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../lib/security/request-guards.js'
import { BookingCommandError, bookingCommandResponse, createAppointment, rescheduleAppointment } from '../../../../lib/booking/commands.js'
import { sendBookingNotification } from '../../../../lib/notifications/notify.js'

const statuses = new Set(['pending', 'confirmed', 'completed', 'cancelled', 'no_show'])
const appointmentSelect = 'id,reference,customer_name,customer_phone,customer_email,customer_id,customer_package_id,starts_at,ends_at,status,admin_notes,staff_id,service_id,source,services(name,duration_minutes),staff(name,display_name)'
const hkDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(new Date(`${value}T00:00:00+08:00`).getTime()) ? value : null
const hkToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const range = request => {
  const query = new URL(request.url).searchParams
  const from = hkDay(query.get('from')) || hkToday()
  const to = hkDay(query.get('to')) || from
  const end = new Date(`${to}T00:00:00+08:00`)
  end.setUTCDate(end.getUTCDate() + 1)
  return { from: new Date(`${from}T00:00:00+08:00`).toISOString(), to: end.toISOString() }
}
const asAppointment = row => ({
  id: row.id, reference: row.reference, customerName: row.customer_name, customerPhone: row.customer_phone,
  customerEmail: row.customer_email, customerId: row.customer_id, customerPackageId: row.customer_package_id,
  startsAt: row.starts_at, endsAt: row.ends_at, status: row.status, adminNotes: row.admin_notes,
  staffId: row.staff_id, staffName: row.staff?.display_name || row.staff?.name || '未指派',
  serviceId: row.service_id, serviceName: row.services?.name || '服務', source: row.source,
})
const commandInput = body => ({
  serviceId: body.serviceId, startsAt: body.startsAt, staffPreference: body.staffPreference ?? body.staffId,
  customer: { id: body.customerId || null, name: body.customerName, phone: body.customerPhone, email: body.customerEmail },
  customerPackageId: body.customerPackageId || null, notes: body.notes, source: 'admin',
})

export function createAdminAppointmentsHandlers({
  adminContext: resolveContext = () => adminContext(),
  guardMutationRequest: guardMutation = (...args) => guardMutationRequest(...args),
  createAppointment: create = createAppointment,
  rescheduleAppointment: reschedule = rescheduleAppointment,
  audit: writeAudit = audit,
  notify = sendBookingNotification,
} = {}) {
  return {
    async GET(request) {
      const context = await resolveContext()
      if (context.response) return context.response
      const dates = range(request)
      let query = context.db.from('appointments').select(appointmentSelect).gte('starts_at', dates.from).lt('starts_at', dates.to).order('starts_at').limit(500)
      const params = new URL(request.url).searchParams
      const staffId = Number(params.get('staffId'))
      const serviceId = Number(params.get('serviceId'))
      if (Number.isSafeInteger(staffId) && staffId > 0) query = query.eq('staff_id', staffId)
      if (Number.isSafeInteger(serviceId) && serviceId > 0) query = query.eq('service_id', serviceId)
      if (statuses.has(params.get('status'))) query = query.eq('status', params.get('status'))
      const { data, error } = await query
      return error ? jsonError('Unable to load appointments.', 500) : NextResponse.json({ appointments: (data || []).map(asAppointment), range: dates })
    },
    async POST(request) {
      const guard = await guardMutation(request, { rateLimit: { scope: 'admin.appointments', limit: 60, windowMs: 60_000 } })
      if (guard) return guard
      try {
        const context = await resolveContext()
        if (context.response) return context.response
        const body = await request.json().catch(() => { throw new BookingCommandError('validation_error') })
        const result = await create(context.db, { ...commandInput(body || {}), actorUserId: context.auth.user.id })
        await writeAudit(context.db, context.auth.user, 'appointment.create', 'appointments', result.appointment.id, { source: 'admin' })
        try { await notify({ event: 'booking_confirmation', booking: result.appointment }) } catch { /* booking remains committed */ }
        return NextResponse.json({ appointment: result.appointment }, { status: 201 })
      } catch (error) { return bookingCommandResponse(error) }
    },
    async PATCH(request) {
      const guard = await guardMutation(request, { rateLimit: { scope: 'admin.appointments', limit: 60, windowMs: 60_000 } })
      if (guard) return guard
      try {
        const context = await resolveContext()
        if (context.response) return context.response
        const body = await request.json().catch(() => { throw new BookingCommandError('validation_error') })
        const id = Number(body?.id)
        if (!Number.isSafeInteger(id) || id < 1) throw new BookingCommandError('validation_error')
        if (body.startsAt) {
          const appointment = await reschedule(context.db, { appointmentId: id, startsAt: body.startsAt, staffPreference: body.staffPreference ?? body.staffId, actorUserId: context.auth.user.id })
          await writeAudit(context.db, context.auth.user, 'appointment.reschedule', 'appointments', id, { startsAt: appointment.starts_at, staffId: appointment.staff_id })
          try { await notify({ event: 'booking_reschedule', booking: appointment }) } catch { /* booking remains committed */ }
          return NextResponse.json({ appointment })
        }
        if (!statuses.has(body.status)) throw new BookingCommandError('validation_error')
        const update = { status: body.status, admin_notes: String(body.adminNotes || '').slice(0, 2000) }
        const { data, error } = await context.db.from('appointments').update(update).eq('id', id).select(appointmentSelect).single()
        if (error) return jsonError('Unable to update appointment.', 500)
        await writeAudit(context.db, context.auth.user, 'appointment.update', 'appointments', id, { status: update.status })
        return NextResponse.json({ appointment: asAppointment(data) })
      } catch (error) { return bookingCommandResponse(error) }
    },
  }
}

export async function GET(request) { return createAdminAppointmentsHandlers().GET(request) }
export async function POST(request) { return createAdminAppointmentsHandlers().POST(request) }
export async function PATCH(request) { return createAdminAppointmentsHandlers().PATCH(request) }
