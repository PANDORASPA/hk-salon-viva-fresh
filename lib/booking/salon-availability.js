const ZONE = 'Europe/London'
const partsFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })

const zoneParts = (date) => Object.fromEntries(partsFormatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
const londonLocalToUtc = (date, time) => {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const desired = Date.UTC(year, month - 1, day, hour, minute)
  let guess = new Date(desired)
  for (let index = 0; index < 3; index += 1) {
    const actual = zoneParts(guess)
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute)
    guess = new Date(guess.getTime() + desired - represented)
  }
  return guess
}

const londonDateWindow = (date) => {
  const next = new Date(`${date}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const nextDate = next.toISOString().slice(0, 10)
  return { start:londonLocalToUtc(date, '00:00'), end:londonLocalToUtc(nextDate, '00:00') }
}

const minutes = (time) => { const [hour, minute] = String(time).slice(0, 5).split(':').map(Number); return hour * 60 + minute }
const displayTime = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const overlaps = (start, end, appointment) => {
  if (appointment.status === 'cancelled') return false
  return start < new Date(appointment.ends_at).getTime() && end > new Date(appointment.starts_at).getTime()
}

const buildAvailability = ({ date, durationMinutes, bufferMinutes = 15, hours, blocked, appointments = [], stepMinutes = 75 }) => {
  if (blocked || !hours?.is_open || !hours.opens_at || !hours.closes_at) return []
  const open = minutes(hours.opens_at), close = minutes(hours.closes_at), slots = []
  for (let cursor = open; cursor + durationMinutes <= close; cursor += stepMinutes) {
    const label = displayTime(cursor)
    const start = londonLocalToUtc(date, label).getTime()
    const end = start + (durationMinutes + bufferMinutes) * 60_000
    if (!appointments.some((appointment) => overlaps(start, end, appointment))) slots.push(label)
  }
  return slots
}

module.exports = { buildAvailability, londonLocalToUtc, londonDateWindow }
