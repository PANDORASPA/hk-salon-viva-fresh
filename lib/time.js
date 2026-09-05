export function normalizeTime(value) {
  if (!value) return ''
  const s = String(value)
  return s.length >= 5 ? s.substring(0, 5) : s
}

export function parseTimeToMinutes(value) {
  const t = normalizeTime(value)
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

export function minutesToTime(minutes) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.floor(minutes)))
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export function addMinutesToTime(time, addMinutes) {
  const start = parseTimeToMinutes(time)
  if (start == null) return ''
  return minutesToTime(start + addMinutes)
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart
}

export function parseList(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean)
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return []
    try {
      if (s.startsWith('[')) {
        const arr = JSON.parse(s)
        return Array.isArray(arr) ? arr.map(v => String(v).trim()).filter(Boolean) : [String(arr).trim()].filter(Boolean)
      }
    } catch (e) {}
    return s.split(',').map(v => v.trim()).filter(Boolean)
  }
  return [String(value).trim()].filter(Boolean)
}

