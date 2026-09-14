import { buildStaffAvailability } from '../../../lib/booking/availability-v2.js'
import { toBookingHttpError } from '../../../lib/booking/errors.js'
import { loadAvailability } from '../../../lib/booking/load-availability.js'
import { getServiceClient } from '../../../lib/supabase/service.js'

function positiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value || '')) return null
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : null
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function staffPreference(value) {
  if (value == null || value === 'any') return 'any'
  return positiveInteger(value)
}

function errorResponse(code) {
  const error = toBookingHttpError(code)
  return Response.json({ error: error.message, code: error.code }, { status: error.status })
}

export function createAvailabilityHandler({
  getServiceClient: serviceClient = getServiceClient,
  now = () => new Date(),
  logger = console,
} = {}) {
  return async function availabilityHandler(request) {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const serviceId = positiveInteger(searchParams.get('serviceId'))
    const staffId = staffPreference(searchParams.get('staffId'))
    if (!validDate(date) || serviceId == null || staffId == null) return errorResponse('validation_error')

    try {
      const db = await serviceClient()
      const loaded = await loadAvailability({ db, date, serviceId, logger })
      const staff = staffId === 'any'
        ? loaded.staff
        : loaded.staff.filter((person) => Number(person.id) === staffId)
      const availability = buildStaffAvailability({ ...loaded, date, staff, now: now() })
      return Response.json({
        date,
        serviceId,
        staffId,
        timezone: 'Asia/Hong_Kong',
        slots: availability.slots,
        staffAvailability: availability.staffAvailability,
      })
    } catch (error) {
      if (error?.code !== 'availability_unavailable') {
        logger?.error?.('Availability handler failed', { date, serviceId, error })
      }
      return errorResponse('availability_unavailable')
    }
  }
}

let routeDependencies = { getServiceClient }
export function __setAvailabilityRouteDependencies(overrides = {}) {
  routeDependencies = { getServiceClient, ...overrides }
}

export async function GET(request) {
  return createAvailabilityHandler(routeDependencies)(request)
}
