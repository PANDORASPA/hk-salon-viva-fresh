function weekdayFor(date) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function dateWindow(date) {
  const start = new Date(`${date}T00:00:00+08:00`)
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

function publicStaff(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    bio: row.bio ?? null,
    colourHex: row.colour_hex,
  }
}

function bySortOrderThenId(a, b) {
  return Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.id) - Number(b.id)
}

function ordered(query) {
  return typeof query.order === 'function'
    ? query.order('sort_order').order('id')
    : query
}

function activeAppointments(query) {
  return typeof query.in === 'function'
    ? query.in('status', ['pending', 'confirmed', 'completed'])
    : query.neq('status', 'cancelled')
}

function endsAfter(query, value) {
  return typeof query.gt === 'function' ? query.gt('ends_at', value) : query.gte('ends_at', value)
}

function schedulingSettings(row) {
  const data = row?.data || {}
  return {
    bufferMinutes: data.booking_buffer_minutes ?? data.buffer_minutes ?? data.bufferMinutes,
    stepMinutes: data.slot_step_minutes ?? data.step_minutes ?? data.stepMinutes,
    minimumLeadMinutes: data.minimum_lead_minutes ?? data.minimumLeadMinutes,
    maximumAdvanceDays: data.maximum_advance_days ?? data.maximumAdvanceDays,
  }
}

function schedulingStaff(rows, links, serviceId) {
  const linked = new Set(
    links
      .filter((link) => Number(link.service_id) === serviceId)
      .map((link) => String(link.staff_id)),
  )
  return rows
    .filter((row) => row.is_active === true && linked.has(String(row.id)))
    .sort(bySortOrderThenId)
    .map((row) => ({ id: row.id, is_active: true, service_ids: [serviceId] }))
}

function queryErrors(names, results) {
  return results.flatMap((result, index) => result.error ? [{ source: names[index], error: result.error }] : [])
}

function failOnQueryErrors({ names, results, logger, operation, context }) {
  const failures = queryErrors(names, results)
  if (!failures.length) return
  logger?.error?.(`${operation} failed`, { ...context, failures })
  throw new AvailabilityLoadError()
}

export class AvailabilityLoadError extends Error {
  constructor() {
    super('Availability data could not be loaded')
    this.name = 'AvailabilityLoadError'
    this.code = 'availability_unavailable'
  }
}

export async function loadPublicStaff({ db, serviceId, logger = console }) {
  const names = ['services', 'staff', 'staff_services']
  const results = await Promise.all([
    db.from('services')
      .select('id')
      .eq('id', serviceId)
      .eq('enabled', true)
      .eq('published', true)
      .maybeSingle(),
    ordered(db.from('staff')
      .select('id,display_name,bio,colour_hex,is_active,sort_order')
      .eq('is_active', true)),
    db.from('staff_services')
      .select('staff_id,service_id')
      .eq('service_id', serviceId),
  ])
  failOnQueryErrors({ names, results, logger, operation: 'Public staff query', context: { serviceId } })

  const [serviceResult, staffResult, linksResult] = results
  if (!serviceResult.data) return []
  const linked = new Set((linksResult.data || []).map((link) => String(link.staff_id)))
  return (staffResult.data || [])
    .filter((row) => row.is_active === true && linked.has(String(row.id)))
    .sort(bySortOrderThenId)
    .map(publicStaff)
}

export async function loadAvailability({ db, date, serviceId, logger = console }) {
  const weekday = weekdayFor(date)
  const window = dateWindow(date)
  const names = [
    'services', 'staff', 'staff_services', 'staff_weekly_hours', 'staff_time_off',
    'appointments', 'business_hours', 'blocked_dates', 'app_settings',
  ]
  const results = await Promise.all([
    db.from('services')
      .select('id,duration_minutes')
      .eq('id', serviceId)
      .eq('enabled', true)
      .eq('published', true)
      .maybeSingle(),
    ordered(db.from('staff')
      .select('id,is_active,sort_order')
      .eq('is_active', true)),
    db.from('staff_services')
      .select('staff_id,service_id')
      .eq('service_id', serviceId),
    db.from('staff_weekly_hours')
      .select('staff_id,weekday,is_working,starts_at,ends_at')
      .eq('weekday', weekday),
    endsAfter(db.from('staff_time_off')
      .select('staff_id,starts_at,ends_at')
      .lt('starts_at', window.end), window.start),
    activeAppointments(db.from('appointments')
      .select('staff_id,starts_at,occupied_until,status'))
      .gte('starts_at', window.start)
      .lt('starts_at', window.end),
    db.from('business_hours')
      .select('weekday,is_open,opens_at,closes_at')
      .eq('weekday', weekday)
      .maybeSingle(),
    db.from('blocked_dates')
      .select('starts_on,ends_on')
      .lte('starts_on', date)
      .gte('ends_on', date),
    db.from('app_settings')
      .select('data')
      .eq('id', 1)
      .maybeSingle(),
  ])
  failOnQueryErrors({ names, results, logger, operation: 'Availability query', context: { date, serviceId } })

  const [
    serviceResult, staffResult, linksResult, weeklyResult, timeOffResult,
    appointmentsResult, businessResult, blockedResult, settingsResult,
  ] = results
  if (!serviceResult.data) {
    logger?.error?.('Availability service was not found', { date, serviceId })
    throw new AvailabilityLoadError()
  }

  return {
    service: serviceResult.data,
    staff: schedulingStaff(staffResult.data || [], linksResult.data || [], serviceId),
    weeklyHours: weeklyResult.data || [],
    timeOff: timeOffResult.data || [],
    appointments: appointmentsResult.data || [],
    businessHours: businessResult.data,
    blocked: blockedResult.data || [],
    settings: schedulingSettings(settingsResult.data),
  }
}
