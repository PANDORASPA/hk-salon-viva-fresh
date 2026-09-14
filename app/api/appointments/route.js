import { getServiceClient } from '../../../lib/supabase/service.js'
import { getServerClient } from '../../../lib/supabase/server.js'
import { resolveAuthenticatedCustomer } from '../../../lib/customers/identity.js'
import { guardMutationRequest } from '../../../lib/security/request-guards.js'
import { BookingCommandError, bookingCommandResponse, createAppointment } from '../../../lib/booking/commands.js'
import { sendBookingNotification } from '../../../lib/notifications/notify.js'

export function createAppointmentsHandler({
  getServiceClient: serviceClient = getServiceClient,
  getServerClient: serverClient = getServerClient,
  resolveCustomer = async () => {
    const customer = await resolveAuthenticatedCustomer(await serverClient(), await serviceClient())
    return customer ? { customer, actorUserId: customer.user_id } : null
  },
  notify = sendBookingNotification,
} = {}) {
  return async function appointmentsHandler(request) {
    const guard = await guardMutationRequest(request, { rateLimit: { scope: 'booking', limit: 10, windowMs: 3_600_000 } })
    if (guard) return guard
    try {
      const body = await request.json().catch(() => { throw new BookingCommandError('validation_error') })
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BookingCommandError('validation_error')
      const context = await resolveCustomer(request)
      const authenticatedCustomer = context?.customer || null
      const actorUserId = context?.actorUserId || null
      if (body.customerPackageId != null && !actorUserId) throw new BookingCommandError('authentication_required')
      const db = await serviceClient()
      // The RPC rechecks availability and rejects invalid or past booking time
      // under the same transaction as staff assignment and package redemption.
      const result = await createAppointment(db, {
        serviceId: body.serviceId,
        staffPreference: body.staffPreference ?? body.staffId,
        startsAt: body.startsAt,
        // Booking contact is distinct from identity. A submitted name is validated
        // by the command and stored only on this appointment, leaving profile
        // edits intact. Omitted names use the owned profile's current name.
        customer: authenticatedCustomer ? {
          ...authenticatedCustomer,
          name: Object.hasOwn(body, 'customerName') ? body.customerName : authenticatedCustomer.name,
          phone: authenticatedCustomer.phone || body.customerPhone,
        } : { name: body.customerName, phone: body.customerPhone, email: body.customerEmail },
        actorUserId,
        customerPackageId: body.customerPackageId ?? null,
        source: actorUserId ? 'account' : 'web',
        notes: body.notes,
      })
      try { await notify({ event: 'booking_confirmation', booking: result.appointment }) }
      catch { /* Notification delivery is independent of the committed booking. */ }
      return Response.json(result, { status: 201 })
    } catch (error) { return bookingCommandResponse(error) }
  }
}

let routeDependencies = { getServiceClient }
export function __setAppointmentsRouteDependencies(overrides = {}) {
  routeDependencies = { getServiceClient, ...overrides }
}

export async function POST(request) {
  return createAppointmentsHandler(routeDependencies)(request)
}
