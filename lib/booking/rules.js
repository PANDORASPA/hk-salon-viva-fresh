const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

/** Validate the booking window using only the supplied clock value. */
export function validateBookingWindow({
  startsAt,
  now,
  minimumLeadMinutes = 120,
  maximumAdvanceDays = 90,
} = {}) {
  const start = toMillis(startsAt)
  const current = toMillis(now)
  const lead = Number(minimumLeadMinutes)
  const horizon = Number(maximumAdvanceDays)
  if (!Number.isFinite(start) || !Number.isFinite(current) || !Number.isFinite(lead) || !Number.isFinite(horizon)) {
    return { ok: false, code: 'booking_window_invalid' }
  }
  if (start < current + Math.max(0, lead) * MINUTE || start > current + Math.max(0, horizon) * DAY) {
    return { ok: false, code: 'booking_window_invalid' }
  }
  return { ok: true }
}

export function toMillis(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return NaN
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(result) ? result : NaN
}
