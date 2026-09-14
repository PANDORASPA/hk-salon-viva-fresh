import { getServerClient } from '../../../../../lib/supabase/server.js'
import { getServiceClient } from '../../../../../lib/supabase/service.js'
import { guardMutationRequest } from '../../../../../lib/security/request-guards.js'
import { BookingCommandError, bookingCommandResponse, positiveBookingId, publicAppointment,
  rescheduleAppointment, cancelAppointment } from '../../../../../lib/booking/commands.js'
import { sendBookingNotification } from '../../../../../lib/notifications/notify.js'

function localStartsAt(date, time) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new BookingCommandError('validation_error')
  }
  const calendar = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0,10) !== date) {
    throw new BookingCommandError('validation_error')
  }
  // Preserve the validated local fields. A permissive Date.UTC conversion
  // would normalize September 31, 24:xx or overflowing minutes into a new slot.
  return `${date}T${time}:00+08:00`
}

export function createAccountBookingHandlers({
  getServerClient: serverClient = getServerClient,
  getServiceClient: serviceClient = getServiceClient,
  notify = sendBookingNotification,
} = {}) {
  async function actor() {
    const db = await serverClient()
    const { data, error } = await db.auth.getUser()
    if (error || !data?.user) throw new BookingCommandError('authentication_required')
    return { db, user: data.user }
  }
  async function idFrom(context) { return positiveBookingId((await context?.params)?.id) }
  async function send(event, booking) {
    try { await notify({ event, booking }) } catch { /* Committed bookings survive notification failure. */ }
  }
  return {
    async GET(_request, context) {
      try {
        const id = await idFrom(context)
        const { db, user } = await actor()
        const { data, error } = await db.from('appointments')
          .select('id, reference, user_id, customer_id, service_id, staff_id, customer_package_id, customer_name, customer_phone, customer_email, starts_at, ends_at, status, services(name, duration_minutes, price)')
          .eq('id', id).eq('user_id', user.id).maybeSingle()
        if (error) throw error
        if (!data) throw new BookingCommandError('booking_not_found')
        if (data.user_id !== user.id) throw new BookingCommandError('ownership_forbidden')
        return Response.json({ booking: { ...publicAppointment(data), services: data.services } })
      } catch (error) { return bookingCommandResponse(error) }
    },
    async PATCH(request, context) {
      const guard = await guardMutationRequest(request, { rateLimit: { scope: 'booking.reschedule', limit: 20, windowMs: 3_600_000 } })
      if (guard) return guard
      try {
        const appointmentId = await idFrom(context)
        const { user } = await actor()
        const body = await request.json().catch(() => { throw new BookingCommandError('validation_error') })
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BookingCommandError('validation_error')
        let startsAt = body.startsAt
        if (!startsAt && body.date && body.time) {
          startsAt = localStartsAt(body.date, body.time)
        }
        const booking = await rescheduleAppointment(await serviceClient(), {
          appointmentId, startsAt, staffPreference: body.staffPreference ?? body.staffId,
          actorUserId: user.id,
        })
        await send('booking_reschedule', booking)
        return Response.json({ booking })
      } catch (error) { return bookingCommandResponse(error) }
    },
    async DELETE(request, context) {
      const guard = await guardMutationRequest(request, { rateLimit: { scope: 'booking.cancel', limit: 30, windowMs: 3_600_000 } })
      if (guard) return guard
      try {
        const appointmentId = await idFrom(context)
        const { user } = await actor()
        const booking = await cancelAppointment(await serviceClient(), { appointmentId, actorUserId: user.id })
        await send('booking_cancellation', booking)
        return Response.json({ booking })
      } catch (error) { return bookingCommandResponse(error) }
    },
  }
}

let routeDependencies = { getServerClient, getServiceClient }
export function __setAccountBookingRouteDependencies(overrides = {}) {
  routeDependencies = { getServerClient, getServiceClient, ...overrides }
}
export async function GET(request, context) { return createAccountBookingHandlers(routeDependencies).GET(request, context) }
export async function PATCH(request, context) { return createAccountBookingHandlers(routeDependencies).PATCH(request, context) }
export async function DELETE(request, context) { return createAccountBookingHandlers(routeDependencies).DELETE(request, context) }
