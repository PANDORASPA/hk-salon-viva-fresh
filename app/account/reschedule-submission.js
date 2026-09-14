/** Submit the requested local HK time to the atomic server command. */
export async function submitAccountReschedule({ fetcher, bookingId, date, time, staffPreference }) {
  const response = await fetcher(`/api/account/bookings/${bookingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, time, staffPreference }),
  })
  const body = await response.json()
  if (!response.ok) return { ok: false, status: response.status, error: body.error || '改期失敗' }
  return { ok: true, booking: body.booking }
}
