import { loadConfirmationAppointment } from './confirmation.js'
import { buildIcs } from '../format.js'
import { isAuthSessionMissingError } from '@supabase/supabase-js'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
}

function privateResponse(body, { status, headers } = {}) {
  return new Response(body, { status, headers: { ...PRIVATE_HEADERS, ...headers } })
}

export function createIcsHandler({ getServerClient, getServiceClient }) {
  return async function icsHandler(request, context) {
    const { id } = await context.params
    const token = new URL(request.url).searchParams.get('token')
    const serverDatabase = await getServerClient()
    let authResult
    try { authResult = await serverDatabase.auth.getUser() }
    catch { return privateResponse('Service temporarily unavailable', { status: 503 }) }
    const { data: { user } = {}, error: authError } = authResult || {}
    if (authError && !isAuthSessionMissingError(authError)) {
      return privateResponse('Service temporarily unavailable', { status: 503 })
    }
    const appointment = await loadConfirmationAppointment({
      id,
      confirmationToken: token,
      user: authError ? null : user,
      serverDatabase,
      serviceDatabase: getServiceClient,
    })
    if (!appointment) return privateResponse('Appointment not found', { status: 404 })

    const ics = buildIcs({
      uid: `appt-${appointment.id}`,
      summary: `SALON POKE BY VIVA · ${appointment.services?.name || '預約'}`,
      description: `預約 #${appointment.reference || appointment.id}`,
      location: 'SALON POKE BY VIVA',
      startsAt: appointment.starts_at,
      durationMinutes: appointment.services?.duration_minutes || 60,
    })
    return privateResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="salon-poke-${appointment.reference || appointment.id}.ics"`,
      },
    })
  }
}
