/**
 * Salon availability for SALON POKE BY VIVA (Hong Kong).
 *
 * All slot math is in `Asia/Hong_Kong` (UTC+8, no DST). The historical
 * `Europe/London` version was a leftover from a Bristol-style schema and
 * silently shifted every booking by 7–8 hours. If you grep for
 * `Europe/London` you should find zero references outside test fixtures
 * — anything that mentions London is a bug.
 *
 * Slot labels are local HK time (HH:mm) and the API returns ISO strings
 * with an explicit `+08:00` offset so the booking API can store them
 * directly into `timestamptz` without ambiguity.
 */

const ZONE = 'Asia/Hong_Kong'
const HK_OFFSET = '+08:00'

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
})

const zoneParts = (date) => Object.fromEntries(
  partsFormatter.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]),
)

/**
 * Build a UTC Date that represents the given local HK time on the given
 * HK date. Because HK is fixed UTC+8 (no DST) we can compute this
 * directly: utc = hk - 8h.
 */
const hkLocalToUtc = (date, time) => {
  const [year, month, day] = String(date).split('-').map(Number)
  const [hour, minute] = String(time).slice(0, 5).split(':').map(Number)
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`hkLocalToUtc: invalid input date=${date} time=${time}`)
  }
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute))
}

/**
 * Build a fully-offset ISO string the booking API can store verbatim
 * into a `timestamptz` column. e.g. `2026-09-10T10:00:00+08:00`.
 */
const hkLocalToIso = (date, time) => {
  const utc = hkLocalToUtc(date, time)
  const local = zoneParts(utc)
  const hh = String(local.hour).padStart(2, '0')
  const mm = String(local.minute).padStart(2, '0')
  const ss = String(local.second).padStart(2, '0')
  return `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}T${hh}:${mm}:${ss}${HK_OFFSET}`
}

/**
 * UTC window covering the HK date in question. Useful for filtering
 * appointments whose `starts_at` is stored as `timestamptz`.
 */
const hkDateWindow = (date) => {
  const start = hkLocalToUtc(date, '00:00')
  const end = hkLocalToUtc(date, '24:00')
  return { start, end }
}

const minutes = (time) => {
  const [hour, minute] = String(time).slice(0, 5).split(':').map(Number)
  return hour * 60 + minute
}

const displayTime = (value) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

const overlaps = (start, end, appointment) => {
  if (appointment.status === 'cancelled') return false
  return start < new Date(appointment.ends_at).getTime() && end > new Date(appointment.starts_at).getTime()
}

/**
 * Build the list of available slot labels for a given HK date.
 *
 * Returns `{ label, iso }` objects so the UI can show "10:00" while
 * the API receives an unambiguous `2026-09-10T10:00:00+08:00` string.
 *
 * Buffer defaults to 15 minutes so back-to-back appointments don't
 * overlap; admin can change this per-deploy via env or DB later.
 */
const buildAvailability = ({ date, durationMinutes, bufferMinutes = 15, hours, blocked, appointments = [], stepMinutes = 75 }) => {
  if (blocked || !hours?.is_open || !hours.opens_at || !hours.closes_at) return []
  const open = minutes(hours.opens_at)
  const close = minutes(hours.closes_at)
  const slots = []
  for (let cursor = open; cursor + durationMinutes <= close; cursor += stepMinutes) {
    const label = displayTime(cursor)
    const start = hkLocalToUtc(date, label).getTime()
    const end = start + (durationMinutes + bufferMinutes) * 60_000
    if (!appointments.some((appointment) => overlaps(start, end, appointment))) {
      slots.push({ label, iso: hkLocalToIso(date, label) })
    }
  }
  return slots
}

module.exports = {
  buildAvailability,
  hkLocalToUtc,
  hkLocalToIso,
  hkDateWindow,
  // Keep old names exported as aliases so legacy imports / tests don't break.
  londonLocalToUtc: hkLocalToUtc,
  londonDateWindow: hkDateWindow,
}
