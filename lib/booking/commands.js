import { createHash, randomBytes } from 'node:crypto'
import { toBookingHttpError } from './errors.js'

const DATABASE_CODES = Object.freeze({
  B0001: 'authentication_required', B0002: 'slot_unavailable', B0003: 'ownership_forbidden',
  B0004: 'service_unavailable', B0005: 'booking_window_invalid', B0006: 'validation_error',
  B0007: 'package_not_usable', B0008: 'booking_not_found', B0009: 'booking_not_changeable',
  B0010: 'late_cancellation', '23P01': 'slot_unavailable', '23514': 'validation_error',
  '23502': 'validation_error', '22P02': 'validation_error', '22007': 'validation_error',
  '22008': 'validation_error',
})

export class BookingCommandError extends Error {
  constructor(code) {
    const safe = toBookingHttpError(code)
    super(safe.message)
    this.name = 'BookingCommandError'
    this.code = safe.code
    this.status = safe.status
  }
}

export function bookingCommandError(error) {
  if (error instanceof BookingCommandError) return error
  const safe = new BookingCommandError(DATABASE_CODES[error?.code] || 'internal_error')
  if (error?.code === 'B0010') {
    // Only two numeric policy values from our own error contract may cross the
    // boundary. Arbitrary PostgreSQL detail, hint and context never do.
    try {
      const detail = JSON.parse(error.details ?? error.detail ?? '{}')
      const publicDetails = {}
      for (const key of ['cutoffHours','hoursUntilStart']) {
        if (typeof detail[key] === 'number' && Number.isFinite(detail[key]) && detail[key] >= 0) publicDetails[key] = detail[key]
      }
      safe.publicDetails = publicDetails
    } catch { /* Malformed details do not alter the stable error. */ }
  }
  return safe
}

export function bookingCommandResponse(error) {
  const safe = bookingCommandError(error)
  return Response.json({ error: safe.message, code: safe.code, ...safe.publicDetails }, { status: safe.status })
}

export function positiveBookingId(value) {
  if (!/^[1-9]\d*$/.test(String(value ?? '')) || !Number.isSafeInteger(Number(value))) {
    throw new BookingCommandError('validation_error')
  }
  return Number(value)
}

function staffPreference(value) {
  return value == null || value === 'any' ? 'any' : String(positiveBookingId(value))
}

function timestamp(value) {
  // Offset is mandatory: interpreting a browser wall-clock value in the server
  // timezone can book a different instant. Booking-window policy lives in SQL.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new BookingCommandError('validation_error')
  }
  const parsed = new Date(value)
  const calendar = new Date(`${value.slice(0,10)}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || !Number.isFinite(calendar.getTime())
    || calendar.toISOString().slice(0,10) !== value.slice(0,10) || Number(value.slice(11,13)) > 23) {
    throw new BookingCommandError('validation_error')
  }
  return parsed.toISOString()
}

function contact(value, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new BookingCommandError('validation_error')
  return value.trim()
}

// Responses are allowlisted because database rows also contain private notes
// and confirmation hashes. No RPC row is returned directly to a browser.
export function publicAppointment(row) {
  const fields = ['id','reference','user_id','customer_id','service_id','staff_id','customer_package_id',
    'customer_name','customer_phone','customer_email','customer_notes','starts_at','ends_at',
    'occupied_until','buffer_minutes','status','source','created_at','updated_at','cancelled_at','cancelled_by']
  return Object.fromEntries(fields.filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]]))
}

async function command(db, name, input) {
  try {
    const { data, error } = await db.rpc(name, input)
    if (error) throw bookingCommandError(error)
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.id) throw new BookingCommandError('internal_error')
    return publicAppointment(row)
  } catch (error) { throw bookingCommandError(error) }
}

/** customer and actorUserId must come from the server's verified auth context. */
export async function createAppointment(db, input) {
  const serviceId = positiveBookingId(input?.serviceId)
  const startsAt = timestamp(input?.startsAt)
  const staff = staffPreference(input?.staffPreference)
  const customer = input?.customer || {}
  const actorUserId = input?.actorUserId || null
  const customerPackageId = input?.customerPackageId == null ? null : positiveBookingId(input.customerPackageId)
  if (customerPackageId && !actorUserId) throw new BookingCommandError('authentication_required')
  if (customerPackageId && !customer.id) throw new BookingCommandError('ownership_forbidden')
  const customerId = actorUserId && customer.id != null ? positiveBookingId(customer.id) : null
  const source = input?.source || (actorUserId ? 'account' : 'web')
  if (!['web','account','admin'].includes(source)) throw new BookingCommandError('validation_error')
  const name = contact(customer.name, 2, 120)
  const phone = contact(customer.phone, 7, 30)
  const email = customer.email == null || customer.email === '' ? null : contact(customer.email, 3, 254)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BookingCommandError('validation_error')
  const notes = input?.notes == null || input.notes === '' ? null : contact(input.notes, 0, 2000)
  const confirmationToken = randomBytes(32).toString('base64url')
  const appointment = await command(db, 'create_appointment_v2', {
    p_service_id: serviceId, p_starts_at: startsAt, p_staff_preference: staff,
    p_customer_name: name, p_customer_phone: phone, p_customer_email: email,
    p_customer_id: customerId, p_actor_id: actorUserId, p_customer_package_id: customerPackageId,
    p_source: source, p_confirmation_token_hash: createHash('sha256').update(confirmationToken).digest('hex'),
    p_customer_notes: notes,
  })
  return { appointment, confirmationToken }
}

export async function rescheduleAppointment(db, input) {
  if (!input?.actorUserId) throw new BookingCommandError('authentication_required')
  return command(db, 'reschedule_appointment_v2', {
    p_appointment_id: positiveBookingId(input?.appointmentId), p_starts_at: timestamp(input?.startsAt),
    p_staff_preference: staffPreference(input?.staffPreference), p_actor_id: input.actorUserId,
  })
}

export async function cancelAppointment(db, input) {
  if (!input?.actorUserId) throw new BookingCommandError('authentication_required')
  return command(db, 'cancel_appointment_v2', {
    p_appointment_id: positiveBookingId(input?.appointmentId), p_actor_id: input.actorUserId,
  })
}
