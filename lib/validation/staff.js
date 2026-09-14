const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const clockPattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

export const isPositiveSafeInteger = (value) => Number.isSafeInteger(value) && value > 0

const invalid = (errors) => ({ ok: false, errors })

const normalizedName = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length >= 2 && trimmed.length <= 120 ? trimmed : null
}

const isoTimestamp = (value) => {
  if (typeof value !== 'string') return null
  const matched = timestampPattern.exec(value)
  if (!matched) return null
  const [, year, month, day] = matched
  const localDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (localDay.getUTCFullYear() !== Number(year) || localDay.getUTCMonth() !== Number(month) - 1 || localDay.getUTCDate() !== Number(day)) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function validateStaffInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid(['body'])
  const allowed = ['name', 'displayName', 'bio', 'colourHex', 'isActive', 'sortOrder', 'serviceIds']
  if (Object.keys(body).some(key => !allowed.includes(key))) return invalid(['unknown_field'])
  const name = normalizedName(body.name)
  const displayName = normalizedName(body.displayName)
  const colourHex = typeof body.colourHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.colourHex) ? body.colourHex.toLowerCase() : null
  const serviceIds = Array.isArray(body.serviceIds) && body.serviceIds.every(isPositiveSafeInteger) && new Set(body.serviceIds).size === body.serviceIds.length ? body.serviceIds : null
  const bio = body.bio == null ? null : typeof body.bio === 'string' && body.bio.trim().length <= 2000 ? body.bio.trim() || null : undefined
  const sortOrder = Number.isSafeInteger(body.sortOrder) && body.sortOrder >= -100_000 && body.sortOrder <= 100_000 ? body.sortOrder : null
  if (!name || !displayName || !colourHex || !serviceIds || bio === undefined || typeof body.isActive !== 'boolean' || sortOrder === null) return invalid(['staff'])
  return { ok: true, value: { name, displayName, bio, colourHex, isActive: body.isActive, sortOrder, serviceIds } }
}

export function validateWeeklyHours(hours) {
  if (!Array.isArray(hours) || hours.length !== 7) return invalid(['hours'])
  const days = new Set()
  const value = []
  for (const row of hours) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !['weekday', 'isWorking', 'startsAt', 'endsAt'].includes(key))) return invalid(['hours'])
    if (!Number.isSafeInteger(row.weekday) || row.weekday < 0 || row.weekday > 6 || days.has(row.weekday) || typeof row.isWorking !== 'boolean') return invalid(['hours'])
    days.add(row.weekday)
    if (!row.isWorking) {
      if (!(row.startsAt == null && row.endsAt == null)) return invalid(['hours'])
      value.push({ weekday: row.weekday, isWorking: false, startsAt: null, endsAt: null })
      continue
    }
    if (typeof row.startsAt !== 'string' || typeof row.endsAt !== 'string' || !clockPattern.test(row.startsAt) || !clockPattern.test(row.endsAt) || row.startsAt >= row.endsAt) return invalid(['hours'])
    value.push({ weekday: row.weekday, isWorking: true, startsAt: row.startsAt, endsAt: row.endsAt })
  }
  return days.size === 7 ? { ok: true, value } : invalid(['hours'])
}

export function validateTimeOffInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['startsAt', 'endsAt', 'reason'].includes(key))) return invalid(['time_off'])
  const startsAt = isoTimestamp(body.startsAt)
  const endsAt = isoTimestamp(body.endsAt)
  const reason = body.reason == null ? null : typeof body.reason === 'string' && body.reason.trim().length <= 500 ? body.reason.trim() || null : undefined
  if (!startsAt || !endsAt || startsAt >= endsAt || reason === undefined) return invalid(['time_off'])
  return { ok: true, value: { startsAt, endsAt, reason } }
}

export default { isPositiveSafeInteger, validateStaffInput, validateWeeklyHours, validateTimeOffInput }
