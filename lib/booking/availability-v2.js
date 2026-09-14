import { toMillis } from './rules.js'

const ACTIVE = new Set(['pending', 'confirmed', 'completed'])
const MINUTE = 60 * 1000

const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback

function timeMinutes(value) {
  if (value == null) return null
  const text = String(value).slice(0, 5)
  const match = /^(\d{1,2}):(\d{2})$/.exec(text)
  if (!match) return null
  const hours = Number(match[1]); const minutes = Number(match[2])
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return null
  return hours * 60 + minutes
}

function dateWeekday(date) {
  const [year, month, day] = String(date).slice(0, 10).split('-').map(Number)
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(Date.UTC(year, month - 1, day)).getUTCDay() : null
}

function isoAt(date, minute) {
  const [year, month, day] = String(date).slice(0, 10).split('-').map(Number)
  const total = Math.trunc(minute)
  const hour = Math.floor(total / 60)
  const mins = total % 60
  // Service windows are single-day; callers never receive a next-day value.
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00+08:00`
}

function localMillis(date, minute) {
  const [year, month, day] = String(date).slice(0, 10).split('-').map(Number)
  return Date.UTC(year, month - 1, day, Math.floor(minute / 60) - 8, minute % 60)
}

function rowsForDay(value, weekday) {
  if (Array.isArray(value)) return value.filter(row => Number(row?.weekday) === weekday)
  if (value && typeof value === 'object') {
    const row = value[weekday] ?? value[String(weekday)]
    return row ? [row] : (Number(value.weekday) === weekday ? [value] : [])
  }
  return []
}

function isBlocked(blocked, date) {
  if (blocked === true) return true
  if (!Array.isArray(blocked)) return false
  return blocked.some(row => {
    if (typeof row === 'string') return row.slice(0, 10) === date
    if (!row) return false
    const start = String(row.starts_on ?? row.start ?? row.date ?? '').slice(0, 10)
    const end = String(row.ends_on ?? row.end ?? row.date ?? start).slice(0, 10)
    return start && start <= date && end >= date
  })
}

function serviceId(service) { return service?.id ?? service?.service_id }

function serves(staff, service) {
  const wanted = serviceId(service)
  const values = staff?.service_ids ?? staff?.serviceIds ?? staff?.services
  if (values == null && staff?.service_id == null) return false
  if (staff?.service_id != null) return String(staff.service_id) === String(wanted)
  const list = Array.isArray(values) ? values : [values]
  return list.some(value => String(value?.id ?? value?.service_id ?? value) === String(wanted))
}

function businessWindow(businessHours, weekday) {
  const row = rowsForDay(businessHours, weekday)[0]
  if (!row || row.is_open === false) return null
  const start = timeMinutes(row.opens_at ?? row.start ?? row.starts_at)
  const end = timeMinutes(row.closes_at ?? row.end ?? row.ends_at)
  return start != null && end != null && end > start ? { start, end } : null
}

function weeklyWindow(weeklyHours, staffId, weekday) {
  const row = (weeklyHours || []).find(item => String(item?.staff_id ?? item?.staffId) === String(staffId) && Number(item?.weekday) === weekday)
  if (!row || row.is_working === false) return null
  const start = timeMinutes(row.starts_at ?? row.start)
  const end = timeMinutes(row.ends_at ?? row.end)
  return start != null && end != null && end > start ? { start, end } : null
}

function overlaps(start, end, rowStart, rowEnd) { return start < rowEnd && end > rowStart }

export function buildStaffAvailability({
  date, service, staff = [], weeklyHours = [], timeOff = [], appointments = [],
  businessHours, blocked = false, settings = {}, now,
} = {}) {
  const dateText = String(date).slice(0, 10)
  const result = { slots: [], staffAvailability: {} }
  for (const person of staff) result.staffAvailability[String(person.id)] = []
  const weekday = dateWeekday(dateText)
  const shop = businessWindow(businessHours, weekday)
  const duration = number(service?.duration_minutes ?? service?.durationMinutes ?? service?.duration, 60)
  const buffer = number(settings.bufferMinutes ?? settings.buffer_minutes, 15)
  const step = number(settings.stepMinutes ?? settings.step_minutes ?? settings.step, 30)
  const current = toMillis(now)
  const lead = number(settings.minimumLeadMinutes ?? settings.minimum_lead_minutes, 120)
  const horizon = number(settings.maximumAdvanceDays ?? settings.maximum_advance_days, 90)
  if (weekday == null || !Number.isFinite(current) || isBlocked(blocked, dateText) || !shop || duration <= 0 || buffer < 0 || step <= 0) return result

  const eligible = staff.filter(person => person?.is_active !== false && serves(person, service))
  const candidateByStaff = new Map()
  for (const person of eligible) {
    const week = weeklyWindow(weeklyHours, person.id, weekday)
    if (!week) continue
    const start = Math.max(shop.start, week.start)
    const end = Math.min(shop.end, week.end)
    const allowed = []
    for (let minute = start; minute + duration + buffer <= end; minute += step) {
      const candidateStart = localMillis(dateText, minute)
      const candidateEnd = localMillis(dateText, minute + duration + buffer)
      if (candidateStart < current + lead * MINUTE || candidateStart > current + horizon * 24 * 60 * MINUTE) continue
      const off = timeOff.some(row => String(row?.staff_id ?? row?.staffId) === String(person.id) && overlaps(candidateStart, candidateEnd, toMillis(row.starts_at), toMillis(row.ends_at)))
      const booked = appointments.some(row => ACTIVE.has(row?.status) && String(row?.staff_id ?? row?.staffId) === String(person.id) && (() => {
        const startMs = toMillis(row.starts_at)
        const rawEnd = toMillis(row.occupied_until ?? row.ends_at)
        const endMs = row.occupied_until != null ? rawEnd : rawEnd + number(row.buffer_minutes ?? row.bufferMinutes, buffer) * MINUTE
        return Number.isFinite(startMs) && Number.isFinite(endMs) && overlaps(candidateStart, candidateEnd, startMs, endMs)
      })())
      if (!off && !booked) allowed.push({ minute, iso: isoAt(dateText, minute) })
    }
    candidateByStaff.set(String(person.id), allowed)
    result.staffAvailability[String(person.id)] = allowed.map(item => item.iso)
  }

  const union = new Map()
  for (const [id, values] of candidateByStaff) for (const value of values) {
    const current = union.get(value.iso) || { label: value.iso.slice(11, 16), iso: value.iso, staffIds: [] }
    current.staffIds.push(normalizeId(id))
    union.set(value.iso, current)
  }
  result.slots = [...union.values()].sort((a, b) => a.iso.localeCompare(b.iso))
  for (const slot of result.slots) slot.staffIds.sort((a, b) => Number(a) - Number(b))
  return result
}

function normalizeId(value) { return /^-?\d+$/.test(String(value)) ? Number(value) : value }
