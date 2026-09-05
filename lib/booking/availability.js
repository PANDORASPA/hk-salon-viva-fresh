import { intervalsOverlap, normalizeTime, parseList, parseTimeToMinutes, minutesToTime } from '../time'

const DAY_ALIASES = {
  sun: '0',
  sunday: '0',
  mon: '1',
  monday: '1',
  tue: '2',
  tues: '2',
  tuesday: '2',
  wed: '3',
  wednesday: '3',
  thu: '4',
  thur: '4',
  thurs: '4',
  thursday: '4',
  fri: '5',
  friday: '5',
  sat: '6',
  saturday: '6',
}

export function parseBusinessHours(value) {
  const text = String(value || '11:00 - 20:00')
  const parts = text.split('-').map((part) => part.trim())
  if (parts.length !== 2) return { start: '11:00', end: '20:00' }
  const start = normalizeTime(parts[0])
  const end = normalizeTime(parts[1])
  return { start: start || '11:00', end: end || '20:00' }
}

export function getDayOfWeek(dateISO) {
  const date = new Date(`${dateISO}T00:00:00Z`)
  return date.getUTCDay()
}

export function normalizeDayToken(value) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return null
  if (/^[0-6]$/.test(text)) return text
  return DAY_ALIASES[text] || null
}

export function normalizeDayList(value) {
  return parseList(value)
    .map((item) => normalizeDayToken(item))
    .filter(Boolean)
}

export function holidayCoversDate(holiday, dateISO) {
  if (!holiday?.holiday_date) return false
  const start = String(holiday.holiday_date).slice(0, 10)
  const end = String(holiday.end_date || holiday.holiday_date).slice(0, 10)
  return start <= dateISO && end >= dateISO
}

export function getWorkingWindow({ staff, shift, dateISO, shopSettings, holidays = [] }) {
  const dayOfWeek = getDayOfWeek(dateISO)
  const dayKey = String(dayOfWeek)
  const businessHours = parseBusinessHours(shopSettings?.business_hours)

  const shopDaysOff = normalizeDayList(shopSettings?.days_off)
  if (shopDaysOff.includes(dayKey)) return null
  if ((holidays || []).some((holiday) => holiday?.is_closed !== false && holidayCoversDate(holiday, dateISO))) return null

  const baselineStart = normalizeTime(staff?.schedule?.[dayKey]?.start) || businessHours.start
  const baselineEnd = normalizeTime(staff?.schedule?.[dayKey]?.end) || businessHours.end

  if (shift) {
    if (shift.is_off) return null
    const start = normalizeTime(shift.start_time) || baselineStart
    const end = normalizeTime(shift.end_time) || baselineEnd
    if (!start || !end) return null
    return { startMin: parseTimeToMinutes(start), endMin: parseTimeToMinutes(end) }
  }

  const staffDaysOff = normalizeDayList(staff?.daysoff ?? staff?.daysOff)
  if (staffDaysOff.includes(dayKey)) return null
  if (!baselineStart || !baselineEnd) return null
  return { startMin: parseTimeToMinutes(baselineStart), endMin: parseTimeToMinutes(baselineEnd) }
}

export function getBreakIntervals({ staff, breaks, dateISO }) {
  const result = []
  const dayOfWeek = getDayOfWeek(dateISO)

  const start = parseTimeToMinutes(normalizeTime(staff?.break_start))
  const end = parseTimeToMinutes(normalizeTime(staff?.break_end))
  if (start != null && end != null && start < end) {
    result.push({ startMin: start, endMin: end })
  }

  for (const row of breaks || []) {
    if (!row || row.enabled === false) continue
    if (Number(row.day_of_week) !== dayOfWeek) continue
    const rowStart = parseTimeToMinutes(row.start_time)
    const rowEnd = parseTimeToMinutes(row.end_time)
    if (rowStart != null && rowEnd != null && rowStart < rowEnd) {
      result.push({ startMin: rowStart, endMin: rowEnd })
    }
  }

  return result
}

export function getBookedIntervals({ bookings, serviceDurationMinFallback = 60, bufferMinFallback = 0 }) {
  const result = []
  for (const booking of bookings || []) {
    if (!booking) continue
    if (booking.status !== 'pending' && booking.status !== 'confirmed') continue

    const start = parseTimeToMinutes(booking.start_time || booking.time)
    if (start == null) continue

    const duration = Number.isFinite(Number(booking.duration_min)) ? Number(booking.duration_min) : serviceDurationMinFallback
    const buffer = Number.isFinite(Number(booking.buffer_min)) ? Number(booking.buffer_min) : bufferMinFallback
    const end = booking.end_time ? parseTimeToMinutes(booking.end_time) : start + duration
    const bufferEnd = booking.buffer_end_time ? parseTimeToMinutes(booking.buffer_end_time) : end + buffer
    if (end == null || bufferEnd == null) continue

    result.push({ startMin: start, endMin: bufferEnd })
  }
  return result
}

export function getTimeOffIntervals({ timeOffs }) {
  const result = []
  for (const row of timeOffs || []) {
    if (!row) continue
    const start = parseTimeToMinutes(row.start_time)
    const end = parseTimeToMinutes(row.end_time)
    if (start != null && end != null && start < end) {
      result.push({ startMin: start, endMin: end })
    }
  }
  return result
}

export function generateStartSlots({ windowStartMin, windowEndMin, serviceDurationMin, bufferMin, stepMin }) {
  const slots = []
  if (windowStartMin == null || windowEndMin == null) return slots
  const total = (serviceDurationMin || 0) + (bufferMin || 0)
  if (total <= 0) return slots
  const safeStepMin = Number.isFinite(Number(stepMin)) && Number(stepMin) > 0 ? Number(stepMin) : 30
  const lastStart = windowEndMin - total
  for (let current = windowStartMin, count = 0; current <= lastStart && count < 300; current += safeStepMin, count += 1) {
    slots.push(minutesToTime(current))
  }
  return slots
}

export function isTimeSlotAvailable({ startMin, serviceDurationMin, bufferMin, window, breakIntervals, blockedIntervals }) {
  if (!window) return false
  const endMin = startMin + serviceDurationMin
  const bufferEndMin = endMin + bufferMin
  if (startMin < window.startMin || bufferEndMin > window.endMin) return false

  for (const interval of breakIntervals || []) {
    if (intervalsOverlap(startMin, bufferEndMin, interval.startMin, interval.endMin)) return false
  }

  for (const interval of blockedIntervals || []) {
    if (intervalsOverlap(startMin, bufferEndMin, interval.startMin, interval.endMin)) return false
  }

  return true
}

export function getSlotMatrix(params) {
  const {
    staff,
    shift,
    dateISO,
    shopSettings,
    serviceDurationMin,
    bufferMin,
    stepMin,
    bookings,
    breaks,
    timeOffs,
    blockedSlots,
    holidays,
  } = params

  const businessHours = parseBusinessHours(shopSettings?.business_hours)
  const fallbackWindow = {
    startMin: parseTimeToMinutes(businessHours.start),
    endMin: parseTimeToMinutes(businessHours.end),
  }
  const window = getWorkingWindow({ staff, shift, dateISO, shopSettings, holidays })
  const scanWindow = window || fallbackWindow
  if (scanWindow.startMin == null || scanWindow.endMin == null) return []

  const breakIntervals = getBreakIntervals({ staff, breaks, dateISO })
  const blockedIntervals = [
    ...getBookedIntervals({ bookings, serviceDurationMinFallback: serviceDurationMin, bufferMinFallback: bufferMin }),
    ...getTimeOffIntervals({ timeOffs }),
    ...getTimeOffIntervals({ timeOffs: blockedSlots }),
  ]

  const candidateSlots = generateStartSlots({
    windowStartMin: scanWindow.startMin,
    windowEndMin: scanWindow.endMin,
    serviceDurationMin,
    bufferMin,
    stepMin,
  })

  return candidateSlots.map((time) => {
    const startMin = parseTimeToMinutes(time)
    const available =
      startMin != null &&
      isTimeSlotAvailable({
        startMin,
        serviceDurationMin,
        bufferMin,
        window,
        breakIntervals,
        blockedIntervals,
      })

    return { time, available }
  })
}

export function getAvailableSlots(params) {
  return getSlotMatrix(params)
    .filter((slot) => slot.available)
    .map((slot) => slot.time)
}

export function timeToHKTimestamp(dateISO, timeHHMM) {
  const normalized = normalizeTime(timeHHMM)
  return `${dateISO}T${normalized}:00+08:00`
}

export function addMinutesToHKTimestamp(dateISO, timeHHMM, minutes) {
  const startMin = parseTimeToMinutes(timeHHMM)
  if (startMin == null) return null
  return timeToHKTimestamp(dateISO, minutesToTime(startMin + minutes))
}
