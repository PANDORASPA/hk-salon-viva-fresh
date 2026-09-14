import { getServerClient } from '../../../../../lib/supabase/server.js'
import { getServiceClient } from '../../../../../lib/supabase/service.js'
import { guardMutationRequest } from '../../../../../lib/security/request-guards.js'
import { BookingCommandError, bookingCommandResponse, positiveBookingId,
  rescheduleAppointment, cancelAppointment } from '../../../../../lib/booking/commands.js'
import { sendBookingNotification } from '../../../../../lib/notifications/notify.js'
import { ACCOUNT_BOOKING_SELECT, toAccountBooking } from '../../../../../lib/booking/account-booking-view.js'

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

async function readAccountBooking(db, id, userId) {
  const { data, error } = await db.from('appointments')
    .select(ACCOUNT_BOOKING_SELECT)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new BookingCommandError('booking_not_found')
  return toAccountBooking(data)
}

function commandBooking(view, commandRow) {
  // Keep the former command fields for callers that already refresh a row by
  // id, while all displayed data stays on the explicit customer-safe view.
  return { ...view, staff_id: commandRow.staff_id, starts_at: commandRow.starts_at }
}

async function commandAccountBooking(db, commandRow, userId) {
  // The route's injected command boundary in older callers exposes RPC only.
  // A production service client always hydrates staff/redemption data; the
  // fallback retains the safe command projection without widening that seam.
  if (typeof db?.from !== 'function') return commandBooking(toAccountBooking(commandRow), commandRow)
  return commandBooking(await readAccountBooking(db, commandRow.id, userId), commandRow)
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
        const { user } = await actor()
        return Response.json({ booking: await readAccountBooking(await serviceClient(), id, user.id) })
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
        const commandDb = await serviceClient()
        const booking = await rescheduleAppointment(commandDb, {
          appointmentId, startsAt, staffPreference: body.staffPreference ?? body.staffId,
          actorUserId: user.id,
        })
        await send('booking_reschedule', booking)
        return Response.json({ booking: await commandAccountBooking(commandDb, booking, user.id) })
      } catch (error) { return bookingCommandResponse(error) }
    },
    async DELETE(request, context) {
      const guard = await guardMutationRequest(request, { rateLimit: { scope: 'booking.cancel', limit: 30, windowMs: 3_600_000 } })
      if (guard) return guard
      try {
        const appointmentId = await idFrom(context)
        const { user } = await actor()
        const commandDb = await serviceClient()
        const booking = await cancelAppointment(commandDb, { appointmentId, actorUserId: user.id })
        await send('booking_cancellation', booking)
        const view = await commandAccountBooking(commandDb, booking, user.id)
        return Response.json({
          booking: view,
          packageRefunded: Boolean(view.packageRedemption?.refundedAt),
        })
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
