import { toBookingHttpError } from '../../../lib/booking/errors.js'
import { loadPublicStaff } from '../../../lib/booking/load-availability.js'
import { getServiceClient } from '../../../lib/supabase/service.js'

function positiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value || '')) return null
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : null
}

function errorResponse(code) {
  const error = toBookingHttpError(code)
  return Response.json({ error: error.message, code: error.code }, { status: error.status })
}

export function createStaffHandler({
  getServiceClient: serviceClient = getServiceClient,
  logger = console,
} = {}) {
  return async function staffHandler(request) {
    const serviceId = positiveInteger(new URL(request.url).searchParams.get('serviceId'))
    if (serviceId == null) return errorResponse('validation_error')
    try {
      const db = await serviceClient()
      return Response.json({ staff: await loadPublicStaff({ db, serviceId, logger }) })
    } catch (error) {
      if (error?.code !== 'availability_unavailable') {
        logger?.error?.('Public staff handler failed', { serviceId, error })
      }
      return errorResponse('availability_unavailable')
    }
  }
}

export const GET = createStaffHandler()
