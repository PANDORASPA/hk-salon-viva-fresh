import { loadConfirmationAppointment } from './confirmation.js'
import { buildIcs } from '../format.js'

export function createIcsHandler({ getServerClient, getServiceClient }) {
  return async function icsHandler(request, context) {
    const { id } = await context.params
    const token = new URL(request.url).searchParams.get('token')
    const serverDatabase = await getServerClient()
    const { data: { user } = {}, error: authError } = await serverDatabase.auth.getUser()
    if (authError) return new Response('Appointment not found', { status: 404 })
    const appointment = await loadConfirmationAppointment({
      id,
      confirmationToken: token,
      user,
      serverDatabase,
      serviceDatabase: getServiceClient,
    })
    if (!appointment) return new Response('Appointment not found', { status: 404 })

    const ics = buildIcs({
      uid: `appt-${appointment.id}`,
      summary: `SALON POKE BY VIVA · ${appointment.services?.name || '預約'}`,
      description: `預約 #${appointment.reference || appointment.id}`,
      location: 'SALON POKE BY VIVA',
      startsAt: appointment.starts_at,
      durationMinutes: appointment.services?.duration_minutes || 60,
    })
    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="salon-poke-${appointment.reference || appointment.id}.ics"`,
      },
    })
  }
}
