/**
 * Lightweight formatting helpers used by server + client components.
 * Keep dependency-free so they can be imported anywhere.
 */

export function formatAppointmentDateTime(value, { timeZone = 'Asia/Hong_Kong' } = {}) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('zh-HK', {
    timeZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatPriceHkd(penceOrHkd) {
  if (penceOrHkd == null) return null
  const n = Number(penceOrHkd)
  if (!Number.isFinite(n)) return null
  // Convention: the schema stores prices in HKD integer (not pence). Caller
  // should pass the correct unit. We format as integer HKD with thousands sep.
  return new Intl.NumberFormat('zh-HK', { maximumFractionDigits: 0 }).format(n)
}

export function formatPriceFromPence(pence) {
  if (pence == null) return null
  const n = Number(pence)
  if (!Number.isFinite(n)) return null
  return (n / 100).toFixed(0)
}

export function buildIcs({ uid, summary, description, location, startsAt, durationMinutes = 60 }) {
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  const fmt = (d) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SALON POKE BY VIVA//Booking//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@salon-poke-by-viva`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeIcs(summary || 'SALON POKE 預約')}`,
    `DESCRIPTION:${escapeIcs(description || '')}`,
    `LOCATION:${escapeIcs(location || 'SALON POKE BY VIVA')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

function escapeIcs(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}
