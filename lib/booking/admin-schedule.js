import { addMinutesToTime, intervalsOverlap, parseTimeToMinutes } from '../time'

const ACTIVE_BOOKING_STATUSES = new Set(['pending', 'confirmed'])

const T = {
  tables: {
    staff_shifts: '\u73ed\u8868',
    staff_breaks: '\u4f11\u606f\u6642\u9593',
    staff_time_off: '\u8acb\u5047',
    blocked_slots: '\u5c01\u9396\u6642\u6bb5',
  },
  row: '\u7b2c',
  item: '\u7b46',
  invalidStaff: '\u7f3a\u5c11\u6709\u6548\u7684\u54e1\u5de5',
  missingDate: '\u7f3a\u5c11\u65e5\u671f',
  missingTimeRange: '\u5fc5\u9808\u586b\u5beb\u958b\u59cb\u8207\u7d50\u675f\u6642\u9593',
  missingTimeRangeOrAllDay:
    '\u5fc5\u9808\u586b\u5beb\u958b\u59cb\u8207\u7d50\u675f\u6642\u9593\uff0c\u6216\u6539\u70ba\u5168\u65e5\u8acb\u5047',
  invalidTimeFormat: '\u7684\u6642\u9593\u683c\u5f0f\u4e0d\u6b63\u78ba',
  invalidTimeOrder: '\u7684\u958b\u59cb\u6642\u9593\u5fc5\u9808\u65e9\u65bc\u7d50\u675f\u6642\u9593',
  invalidWeekday: '\u7684\u661f\u671f\u683c\u5f0f\u4e0d\u6b63\u78ba',
  unsupportedTable: '\u4e0d\u652f\u63f4\u7684\u6392\u73ed\u8868\u985e\u578b',
  duplicate: '\u8207\u5176\u4ed6\u9805\u76ee\u91cd\u8907',
  overlap: '\u8207\u5176\u4ed6\u9805\u76ee\u6642\u9593\u91cd\u758a',
  conflict: '\u6703\u5f71\u97ff\u73fe\u6709\u9810\u7d04',
  extra: '\u53e6\u6709',
}

const normalizeTime = (value) => {
  if (value == null) return ''
  const text = String(value).trim()
  if (!text) return ''
  return text.length >= 5 ? text.slice(0, 5) : text
}

const normalizeDate = (value) => {
  if (!value) return ''
  const text = String(value).trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text

  const parts = text.split(/[\/.-]/).map((part) => part.trim())
  if (parts.length !== 3) return text

  const [a, b, c] = parts
  if (a.length === 4) return `${a.padStart(4, '0')}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`
  return `${c.padStart(4, '0')}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
}

const getBookingDateIso = (booking) => {
  const direct = normalizeDate(booking?.appointment_date || booking?.date)
  return /^\d{4}-\d{2}-\d{2}$/.test(direct) ? direct : ''
}

const getBookingDayOfWeek = (booking) => {
  const iso = getBookingDateIso(booking)
  if (!iso) return null
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay()
}

const getBookingRange = (booking) => {
  const start = normalizeTime(booking?.start_time || booking?.time)
  if (!start) return null

  const durationMin = Number.isFinite(Number(booking?.duration_min)) ? Number(booking.duration_min) : 60
  const bufferMin = Number.isFinite(Number(booking?.buffer_min)) ? Number(booking.buffer_min) : 0
  const serviceEnd = normalizeTime(booking?.end_time) || addMinutesToTime(start, durationMin)
  const occupiedEnd = normalizeTime(booking?.buffer_end_time) || addMinutesToTime(serviceEnd, bufferMin)

  const startMin = parseTimeToMinutes(start)
  const endMin = parseTimeToMinutes(occupiedEnd)
  if (startMin == null || endMin == null) return null

  return { startMin, endMin }
}

const buildIssue = (type, message) => ({ type, message })

const getLabel = (table) => T.tables[table] || table

const getRowLabel = (table, index) => `${getLabel(table)}${T.row} ${index + 1} ${T.item}`

const getComparableGroupKey = (table, row) => {
  if (table === 'staff_breaks') return `staff:${row.staff_id}|day:${row.day_of_week}`
  if (table === 'staff_time_off') return `staff:${row.staff_id}|date:${row.date}`
  if (table === 'blocked_slots') return `staff:${row.staff_id}|date:${row.date}`
  return ''
}

const getRowRange = (table, row) => {
  if (table === 'staff_breaks' || table === 'blocked_slots') {
    const startMin = parseTimeToMinutes(row.start_time)
    const endMin = parseTimeToMinutes(row.end_time)
    if (startMin == null || endMin == null) return null
    return { startMin, endMin }
  }

  if (table === 'staff_time_off') {
    if (row.is_all_day) return { startMin: 0, endMin: 24 * 60 }
    const startMin = parseTimeToMinutes(row.start_time)
    const endMin = parseTimeToMinutes(row.end_time)
    if (startMin == null || endMin == null) return null
    return { startMin, endMin }
  }

  return null
}

const rowParticipatesInOverlapCheck = (table, row) => {
  if (table === 'staff_breaks') return row.enabled !== false
  return table === 'staff_time_off' || table === 'blocked_slots'
}

const getRowSignature = (table, row) => {
  if (table === 'staff_shifts') {
    // staff_shifts is persisted with a single row per staff/date, so detect duplicates on that natural key
    return [row.staff_id ?? '', row.date ?? ''].join('|')
  }

  if (table === 'staff_breaks') {
    return [row.staff_id ?? '', row.day_of_week ?? '', row.start_time ?? '', row.end_time ?? '', row.label ?? '', row.enabled ? '1' : '0'].join('|')
  }

  if (table === 'staff_time_off') {
    return [row.staff_id ?? '', row.date ?? '', row.is_all_day ? '1' : '0', row.start_time ?? '', row.end_time ?? '', row.reason ?? ''].join('|')
  }

  if (table === 'blocked_slots') {
    return [row.staff_id ?? '', row.date ?? '', row.start_time ?? '', row.end_time ?? '', row.reason ?? '', row.source ?? ''].join('|')
  }

  return JSON.stringify(row)
}

const normalizeRow = (table, rawRow) => {
  const row = { ...rawRow }

  if (row.staff_id != null && row.staff_id !== '') row.staff_id = Number(row.staff_id)
  if (row.day_of_week != null && row.day_of_week !== '') row.day_of_week = Number(row.day_of_week)
  if (row.date) row.date = normalizeDate(row.date)
  if (row.start_time != null) row.start_time = normalizeTime(row.start_time)
  if (row.end_time != null) row.end_time = normalizeTime(row.end_time)
  if (row.is_off != null) row.is_off = Boolean(row.is_off)
  if (row.is_all_day != null) row.is_all_day = Boolean(row.is_all_day)
  if (row.enabled != null) row.enabled = Boolean(row.enabled)
  if (row.label != null) row.label = String(row.label).trim()
  if (row.reason != null) row.reason = String(row.reason).trim()
  if (row.source != null) row.source = String(row.source).trim() || 'manual'

  if (table === 'staff_time_off' && row.is_all_day) {
    row.start_time = ''
    row.end_time = ''
  }

  if (table === 'staff_shifts' && row.is_off) {
    row.start_time = ''
    row.end_time = ''
  }

  return row
}

const validateRow = (table, row, index) => {
  const rowLabel = getRowLabel(table, index)

  if (!Number.isFinite(Number(row.staff_id)) || Number(row.staff_id) <= 0) {
    return buildIssue('error', `${rowLabel} ${T.invalidStaff}`)
  }

  if (table === 'staff_shifts') {
    if (!row.date) return buildIssue('error', `${rowLabel} ${T.missingDate}`)
    if (!row.is_off) {
      if (!row.start_time || !row.end_time) return buildIssue('error', `${rowLabel} ${T.missingTimeRange}`)
      if (parseTimeToMinutes(row.start_time) == null || parseTimeToMinutes(row.end_time) == null) {
        return buildIssue('error', `${rowLabel}${T.invalidTimeFormat}`)
      }
      if (parseTimeToMinutes(row.start_time) >= parseTimeToMinutes(row.end_time)) {
        return buildIssue('error', `${rowLabel}${T.invalidTimeOrder}`)
      }
    }
    return null
  }

  if (table === 'staff_breaks') {
    if (!Number.isInteger(Number(row.day_of_week)) || Number(row.day_of_week) < 0 || Number(row.day_of_week) > 6) {
      return buildIssue('error', `${rowLabel}${T.invalidWeekday}`)
    }
    if (!row.start_time || !row.end_time) return buildIssue('error', `${rowLabel} ${T.missingTimeRange}`)
    if (parseTimeToMinutes(row.start_time) == null || parseTimeToMinutes(row.end_time) == null) {
      return buildIssue('error', `${rowLabel}${T.invalidTimeFormat}`)
    }
    if (parseTimeToMinutes(row.start_time) >= parseTimeToMinutes(row.end_time)) {
      return buildIssue('error', `${rowLabel}${T.invalidTimeOrder}`)
    }
    return null
  }

  if (table === 'staff_time_off') {
    if (!row.date) return buildIssue('error', `${rowLabel} ${T.missingDate}`)
    if (!row.is_all_day) {
      if (!row.start_time || !row.end_time) return buildIssue('error', `${rowLabel} ${T.missingTimeRangeOrAllDay}`)
      if (parseTimeToMinutes(row.start_time) == null || parseTimeToMinutes(row.end_time) == null) {
        return buildIssue('error', `${rowLabel}${T.invalidTimeFormat}`)
      }
      if (parseTimeToMinutes(row.start_time) >= parseTimeToMinutes(row.end_time)) {
        return buildIssue('error', `${rowLabel}${T.invalidTimeOrder}`)
      }
    }
    return null
  }

  if (table === 'blocked_slots') {
    if (!row.date) return buildIssue('error', `${rowLabel} ${T.missingDate}`)
    if (!row.start_time || !row.end_time) return buildIssue('error', `${rowLabel} ${T.missingTimeRange}`)
    if (parseTimeToMinutes(row.start_time) == null || parseTimeToMinutes(row.end_time) == null) {
      return buildIssue('error', `${rowLabel}${T.invalidTimeFormat}`)
    }
    if (parseTimeToMinutes(row.start_time) >= parseTimeToMinutes(row.end_time)) {
      return buildIssue('error', `${rowLabel}${T.invalidTimeOrder}`)
    }
    return null
  }

  return buildIssue('error', `${T.unsupportedTable}\uff1a${table}`)
}

const getConflictingBookings = (table, row, bookings) => {
  const activeBookings = (bookings || []).filter((booking) => ACTIVE_BOOKING_STATUSES.has(String(booking?.status || '').toLowerCase()))

  if (table === 'staff_shifts') {
    return activeBookings.filter((booking) => {
      if (Number(booking?.staff_id) !== Number(row.staff_id)) return false
      if (getBookingDateIso(booking) !== row.date) return false

      const range = getBookingRange(booking)
      if (!range) return false

      if (row.is_off) return true

      const startMin = parseTimeToMinutes(row.start_time)
      const endMin = parseTimeToMinutes(row.end_time)
      if (startMin == null || endMin == null) return false

      return range.startMin < startMin || range.endMin > endMin
    })
  }

  if (table === 'staff_breaks') {
    const targetDay = Number(row.day_of_week)
    const startMin = parseTimeToMinutes(row.start_time)
    const endMin = parseTimeToMinutes(row.end_time)
    if (startMin == null || endMin == null) return []

    return activeBookings.filter((booking) => {
      if (Number(booking?.staff_id) !== Number(row.staff_id)) return false
      if (getBookingDayOfWeek(booking) !== targetDay) return false

      const range = getBookingRange(booking)
      if (!range) return false

      return intervalsOverlap(range.startMin, range.endMin, startMin, endMin)
    })
  }

  if (table === 'staff_time_off' || table === 'blocked_slots') {
    const startMin = row.is_all_day ? 0 : parseTimeToMinutes(row.start_time)
    const endMin = row.is_all_day ? 24 * 60 : parseTimeToMinutes(row.end_time)
    if (startMin == null || endMin == null) return []

    return activeBookings.filter((booking) => {
      if (Number(booking?.staff_id) !== Number(row.staff_id)) return false
      if (getBookingDateIso(booking) !== row.date) return false

      const range = getBookingRange(booking)
      if (!range) return false

      if (row.is_all_day) return true
      return intervalsOverlap(range.startMin, range.endMin, startMin, endMin)
    })
  }

  return []
}

export function analyzeScheduleRows({ table, rows = [], bookings = [] }) {
  const normalizedRows = []
  const issues = []
  const seen = new Set()
  const comparableRows = []

  ;(rows || []).forEach((rawRow, index) => {
    const row = normalizeRow(table, rawRow)
    normalizedRows.push(row)

    const rowIssue = validateRow(table, row, index)
    if (rowIssue) {
      issues.push(rowIssue)
      return
    }

    const signature = getRowSignature(table, row)
    if (seen.has(signature)) {
      issues.push(buildIssue('error', `${getRowLabel(table, index)} ${T.duplicate}`))
      return
    }
    seen.add(signature)

    if (rowParticipatesInOverlapCheck(table, row)) {
      const groupKey = getComparableGroupKey(table, row)
      const range = getRowRange(table, row)
      const overlapTarget = comparableRows.find((item) => item.groupKey === groupKey && range && intervalsOverlap(item.range.startMin, item.range.endMin, range.startMin, range.endMin))
      if (groupKey && range && overlapTarget) {
        issues.push(buildIssue('error', `${getRowLabel(table, index)} ${T.overlap}`))
        return
      }
      if (groupKey && range) {
        comparableRows.push({ groupKey, range })
      }
    }

    const conflicts = getConflictingBookings(table, row, bookings)
    if (conflicts.length > 0) {
      const refs = conflicts
        .slice(0, 3)
        .map((booking) => booking?.ref || `#${booking?.id}`)
        .filter(Boolean)
      const extraCount = conflicts.length - refs.length
      const suffix = extraCount > 0 ? `\uff0c${T.extra} ${extraCount} ${T.item}` : ''
      issues.push(buildIssue('conflict', `${getRowLabel(table, index)} ${T.conflict}\uff1a${refs.join(', ')}${suffix}`))
    }
  })

  return { normalizedRows, issues }
}
