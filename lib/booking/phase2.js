import { addMinutesToTime, intervalsOverlap, parseList, parseTimeToMinutes } from '../time'
import { addMinutesToHKTimestamp, getSlotMatrix, holidayCoversDate, timeToHKTimestamp } from './availability'

const LOCATION_REQUIRED_MESSAGE = 'This service requires a location selection before slots can be offered.'
const OPTIONAL_SERVICE_COLUMNS = ['buffer_min', 'slot_step_min', 'min_booking_qty', 'max_booking_qty', 'booking_mode']

export class Phase2Error extends Error {
  constructor(message, { code = 'phase2_error', status = 400, details = {} } = {}) {
    super(message)
    this.name = 'Phase2Error'
    this.code = code
    this.status = status
    this.details = details
  }
}

export const toLegacyDate = (dateISO) => {
  const [y, m, d] = String(dateISO || '').split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

export const settingsToMap = (rows) => {
  const map = {}
  for (const row of rows || []) {
    if (!row?.key) continue
    map[row.key] = row.value
  }
  return map
}

export const getNumberSetting = (settings, key, fallback) => {
  const raw = settings?.[key]
  const value = typeof raw === 'number' ? raw : Number(String(raw || ''))
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

const ALLOWED_SERVICE_DURATIONS = new Set([30, 60, 90, 120, 180, 240])

const normalizeServiceDuration = (value, fallback = 60) => {
  const parsed = Number(value)
  if (ALLOWED_SERVICE_DURATIONS.has(parsed)) return parsed
  return fallback
}

const normalizeSlotStep = (value, fallback = 30) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  if (parsed < 30) return 30
  return parsed
}

export const safeSelect = async (promise) => {
  const result = await promise
  const message = String(result?.error?.message || '')
  if (
    result?.error &&
    (
      message.includes('does not exist') ||
      message.includes('Could not find the table') ||
      message.includes('schema cache') ||
      message.includes('relation')
    )
  ) {
    return { data: [] }
  }
  return result
}

export const normalizeOptionalNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const hasMissingOptionalServiceColumn = (message = '') =>
  OPTIONAL_SERVICE_COLUMNS.some((column) => String(message).includes(column))

export const staffCanDoService = (staff, serviceId) => {
  const list = parseList(staff?.services).map((item) => String(item).trim()).filter(Boolean)
  if (list.length === 0) return true
  const target = String(serviceId)
  return list.includes(target)
}

export const buildStaffProviderGroupMap = (rows = []) => {
  const map = new Map()
  for (const row of rows) {
    const staffId = normalizeOptionalNumber(row?.staff_id)
    const groupId = normalizeOptionalNumber(row?.provider_group_id)
    if (!staffId || !groupId) continue
    if (!map.has(staffId)) map.set(staffId, new Set())
    map.get(staffId).add(groupId)
  }
  return map
}

export const getStaffProviderGroupIds = (staff, staffProviderGroupMap = new Map()) => {
  const result = Array.from(staffProviderGroupMap.get(Number(staff?.id)) || [])
  const directGroupId = normalizeOptionalNumber(staff?.provider_group_id)
  if (directGroupId && !result.includes(directGroupId)) result.push(directGroupId)
  return result
}

export const staffMatchesProviderGroups = (staff, requiredGroupIds = [], staffProviderGroupMap = new Map()) => {
  if (!requiredGroupIds.length) return true
  const groupSet = new Set(getStaffProviderGroupIds(staff, staffProviderGroupMap))
  return requiredGroupIds.some((groupId) => groupSet.has(Number(groupId)))
}

export const staffMatchesLocation = (staff, locationId) => {
  if (!locationId) return true
  const staffLocationId = normalizeOptionalNumber(staff?.location_id)
  return !staffLocationId || staffLocationId === Number(locationId)
}

export const holidayMatchesScope = (holiday, { dateISO, locationId, staffId, providerGroupIds = [] }) => {
  if (!holidayCoversDate(holiday, dateISO)) return false

  const holidayLocationId = normalizeOptionalNumber(holiday?.location_id)
  const holidayStaffId = normalizeOptionalNumber(holiday?.staff_id)
  const holidayProviderGroupId = normalizeOptionalNumber(holiday?.provider_group_id)

  if (!holidayLocationId && !holidayStaffId && !holidayProviderGroupId) return true
  if (holidayStaffId && holidayStaffId === Number(staffId)) return true
  if (holidayLocationId && locationId && holidayLocationId === Number(locationId)) return true
  if (holidayProviderGroupId && providerGroupIds.includes(Number(holidayProviderGroupId))) return true
  return false
}

const normalizeBookingRow = (booking, durationFallback = 60, bufferFallback = 0) => {
  const startTime = booking?.start_time || booking?.time
  const startMin = parseTimeToMinutes(startTime)
  if (startMin == null) return null

  const durationMin = Number.isFinite(Number(booking?.duration_min)) ? Number(booking.duration_min) : durationFallback
  const bufferMin = Number.isFinite(Number(booking?.buffer_min)) ? Number(booking.buffer_min) : bufferFallback
  const endMin = booking?.end_time ? parseTimeToMinutes(booking.end_time) : startMin + durationMin
  const bufferEndMin = booking?.buffer_end_time ? parseTimeToMinutes(booking.buffer_end_time) : endMin + bufferMin

  if (endMin == null || bufferEndMin == null) return null

  return {
    ...booking,
    startMin,
    endMin,
    bufferEndMin,
    durationMin,
    bufferMin,
  }
}

const buildAvailabilityMaps = (rows = [], key) => {
  const map = new Map()
  for (const row of rows || []) {
    const id = normalizeOptionalNumber(row?.[key])
    if (!id) continue
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(row)
  }
  return map
}

const filterResourceRows = ({ resources = [], resolvedLocationId }) =>
  (resources || []).filter(
    (resource) =>
      resource?.enabled !== false &&
      (!resolvedLocationId || !resource?.location_id || Number(resource.location_id) === Number(resolvedLocationId))
  )

const buildAllocationsByBooking = (allocations = [], excludeBookingId = null) => {
  const map = new Map()
  for (const allocation of allocations || []) {
    if (excludeBookingId != null && String(allocation?.booking_id) === String(excludeBookingId)) continue
    if (!map.has(allocation.booking_id)) map.set(allocation.booking_id, [])
    map.get(allocation.booking_id).push(allocation)
  }
  return map
}

const hasResourceCapacity = ({
  slotTime,
  bookings = [],
  allocations = [],
  resources = [],
  serviceResources = [],
  durationMin,
  bufferMin,
  excludeBookingId = null,
}) => {
  if (!serviceResources.length) return true

  const slotStart = parseTimeToMinutes(slotTime)
  if (slotStart == null) return false
  const slotEnd = slotStart + durationMin + bufferMin
  const resourceMap = new Map((resources || []).map((resource) => [Number(resource.id), resource]))
  const allocationsByBooking = buildAllocationsByBooking(allocations, excludeBookingId)

  return serviceResources.every((requirement) => {
    const resourceId = Number(requirement.resource_id)
    const resource = resourceMap.get(resourceId)
    if (!resource || resource.enabled === false) return false

    const needed = Number(requirement.quantity || 1)
    const capacity = Number(resource.capacity || 1)
    const used = (bookings || []).reduce((sum, booking) => {
      if (!booking || String(booking.id) === String(excludeBookingId)) return sum
      if (booking.status !== 'pending' && booking.status !== 'confirmed') return sum

      const normalized = normalizeBookingRow(booking, durationMin, bufferMin)
      if (!normalized) return sum
      if (!intervalsOverlap(slotStart, slotEnd, normalized.startMin, normalized.bufferEndMin)) return sum

      return sum + (allocationsByBooking.get(booking.id) || [])
        .filter((allocation) => Number(allocation.resource_id) === resourceId)
        .reduce((inner, allocation) => inner + Number(allocation.quantity || 1), 0)
    }, 0)

    return capacity - used >= needed
  })
}

const summarizeConflict = ({ requestedStaffId, evaluation, startTime }) => {
  if (!evaluation.ignoreLocationProviderRules && evaluation.locationSelectionRequired) {
    return { code: 'location_mismatch', status: 409, message: LOCATION_REQUIRED_MESSAGE }
  }

  if (!evaluation.ignoreLocationProviderRules && requestedStaffId && !evaluation.requestedStaffEligible) {
    return { code: 'provider_location_mismatch', status: 409, message: 'Selected staff cannot perform this service under the current location/provider rules.' }
  }

  const resourceBlocked = Object.values(evaluation.staffDiagnostics || {}).some((diagnostic) => diagnostic?.resourceBlockedTimes?.includes(startTime))
  if (resourceBlocked) {
    return { code: 'resource_full', status: 409, message: 'Required resources are fully booked for this time slot.' }
  }

  const holidayBlocked = Object.values(evaluation.staffDiagnostics || {}).some((diagnostic) => diagnostic?.holidayBlocked)
  if (holidayBlocked) {
    return { code: 'holiday_block', status: 409, message: 'This slot is blocked by a holiday or closure rule.' }
  }

  const bufferBlocked = Object.values(evaluation.staffDiagnostics || {}).some((diagnostic) => diagnostic?.baseBlockedTimes?.includes(startTime))
  if (bufferBlocked) {
    return { code: 'buffer_collision', status: 409, message: 'This slot collides with an existing booking, buffer, break, or blocked period.' }
  }

  return { code: 'staff_collision', status: 409, message: 'This time slot is already booked. Please choose another time.' }
}

export async function loadPhase2Context({
  supabase,
  dateISO,
  serviceId,
  requestedLocationId = null,
  requestedStaffId = null,
  excludeBookingId = null,
  ignoreLocationProviderRules = false,
}) {
  const serviceRes = await supabase
    .from('services')
    .select('id,name,price,time,buffer_min,enabled,default_location_id,default_provider_group_id,slot_step_min,min_booking_qty,max_booking_qty,booking_mode')
    .eq('id', serviceId)
    .single()

  if (serviceRes.error && hasMissingOptionalServiceColumn(serviceRes.error.message || '')) {
    const fallbackRes = await supabase
      .from('services')
      .select('id,name,price,time,enabled,default_location_id,default_provider_group_id')
      .eq('id', serviceId)
      .single()
    if (fallbackRes.error || !fallbackRes.data) {
      throw new Phase2Error('Service not found.', { code: 'service_not_found', status: 404 })
    }
    serviceRes.data = fallbackRes.data
    serviceRes.error = null
  }

  if (serviceRes.error || !serviceRes.data) {
    throw new Phase2Error('Service not found.', { code: 'service_not_found', status: 404 })
  }
  if (serviceRes.data.enabled === false) {
    throw new Phase2Error('Service is disabled.', { code: 'service_disabled', status: 400 })
  }

  const settingsRes = await supabase.from('settings').select('key,value')
  if (settingsRes.error) {
    throw new Phase2Error(settingsRes.error.message, { code: 'settings_failed', status: 500 })
  }

  const [serviceLocationsRes, serviceProviderGroupsRes, staffProviderGroupsRes, holidaysRes, serviceResourcesRes] = await Promise.all([
    safeSelect(supabase.from('service_locations').select('*').eq('service_id', serviceId)),
    safeSelect(supabase.from('service_provider_groups').select('*').eq('service_id', serviceId)),
    safeSelect(supabase.from('staff_provider_groups').select('*')),
    safeSelect(supabase.from('holidays').select('*').lte('holiday_date', dateISO)),
    safeSelect(supabase.from('service_resources').select('*').eq('service_id', serviceId)),
  ])

  const service = serviceRes.data
  const shopSettings = settingsToMap(settingsRes.data)
  const durationMin = normalizeServiceDuration(service.time, 60)
  const defaultBufferMin = getNumberSetting(shopSettings, 'default_buffer_min', 15)
  const bufferMin = Number.isFinite(Number(service.buffer_min)) ? Number(service.buffer_min) : defaultBufferMin
  const stepMin = normalizeSlotStep(getNumberSetting(shopSettings, 'slot_step_min', 30), 30)
  const allowedLocationRows = (serviceLocationsRes.data || []).filter((row) => row?.enabled !== false)
  const allowedLocationIds = allowedLocationRows.map((row) => Number(row.location_id)).filter(Number.isFinite)

  if (!ignoreLocationProviderRules && requestedLocationId && allowedLocationIds.length > 0 && !allowedLocationIds.includes(Number(requestedLocationId))) {
    throw new Phase2Error('This service is not available at the selected location.', {
      code: 'location_mismatch',
      status: 400,
      details: { requestedLocationId, allowedLocationIds },
    })
  }

  const defaultLocationId = normalizeOptionalNumber(service?.default_location_id)
  const resolvedLocationId = ignoreLocationProviderRules
    ? null
    : normalizeOptionalNumber(requestedLocationId) ||
      (allowedLocationIds.length === 1 ? allowedLocationIds[0] : defaultLocationId)
  const locationSelectionRequired = ignoreLocationProviderRules
    ? false
    : !normalizeOptionalNumber(requestedLocationId) &&
      allowedLocationIds.length > 1 &&
      !defaultLocationId

  const requiredProviderGroupIds = ignoreLocationProviderRules
    ? []
    : (serviceProviderGroupsRes.data || [])
        .map((row) => Number(row.provider_group_id))
        .filter(Number.isFinite)
  const defaultProviderGroupId = normalizeOptionalNumber(service?.default_provider_group_id)
  if (!ignoreLocationProviderRules && requiredProviderGroupIds.length === 0 && defaultProviderGroupId) {
    requiredProviderGroupIds.push(defaultProviderGroupId)
  }

  const staffProviderGroupMap = buildStaffProviderGroupMap(staffProviderGroupsRes.data || [])
  const staffQuery = supabase.from('staff').select('*').eq('enabled', true).order('name')
  const staffRes = requestedStaffId
    ? await staffQuery.eq('id', requestedStaffId)
    : await staffQuery

  if (staffRes.error) {
    throw new Phase2Error(staffRes.error.message, { code: 'staff_load_failed', status: 500 })
  }

  const staffList = staffRes.data || []
  const eligibleStaff = staffList.filter(
    (staff) =>
      staffCanDoService(staff, serviceId) &&
      (ignoreLocationProviderRules || staffMatchesLocation(staff, resolvedLocationId)) &&
      (ignoreLocationProviderRules || staffMatchesProviderGroups(staff, requiredProviderGroupIds, staffProviderGroupMap))
  )

  const staffIds = (staffList || []).map((staff) => Number(staff.id)).filter(Number.isFinite)
  const { data: shifts, error: shiftsError } = staffIds.length
    ? await supabase.from('staff_shifts').select('*').eq('date', dateISO).in('staff_id', staffIds)
    : { data: [], error: null }
  if (shiftsError) {
    throw new Phase2Error(shiftsError.message, { code: 'shift_load_failed', status: 500 })
  }

  const [breaksRes, timeOffRes, blockedRes] = await Promise.all([
    staffIds.length ? safeSelect(supabase.from('staff_breaks').select('*').in('staff_id', staffIds)) : Promise.resolve({ data: [] }),
    staffIds.length ? safeSelect(supabase.from('staff_time_off').select('*').eq('date', dateISO).in('staff_id', staffIds)) : Promise.resolve({ data: [] }),
    staffIds.length ? safeSelect(supabase.from('blocked_slots').select('*').eq('date', dateISO).in('staff_id', staffIds)) : Promise.resolve({ data: [] }),
  ])

  const bookingsResult = await (async () => {
    const result = await supabase
      .from('bookings')
      .select('id,staff_id,status,start_time,end_time,buffer_end_time,duration_min,buffer_min,time,appointment_date,date,location_id,provider_group_id')
      .eq('appointment_date', dateISO)
    if (!result.error) return result
    if (String(result.error.message || '').includes('appointment_date')) {
      return supabase
        .from('bookings')
        .select('id,staff_id,status,start_time,end_time,buffer_end_time,duration_min,buffer_min,time,appointment_date,date,location_id,provider_group_id')
        .eq('date', toLegacyDate(dateISO))
    }
    return result
  })()
  if (bookingsResult.error) {
    throw new Phase2Error(bookingsResult.error.message, { code: 'booking_load_failed', status: 500 })
  }

  const allBookings = (bookingsResult.data || []).filter((booking) => String(booking.id) !== String(excludeBookingId))
  const bookingIds = allBookings.map((booking) => booking.id).filter(Boolean)
  const resourceIds = (serviceResourcesRes.data || []).map((row) => Number(row.resource_id)).filter(Number.isFinite)
  const [resourcesRes, allocationsRes] = await Promise.all([
    resourceIds.length > 0 ? safeSelect(supabase.from('resources').select('*').in('id', resourceIds)) : Promise.resolve({ data: [] }),
    bookingIds.length > 0 ? safeSelect(supabase.from('booking_resource_allocations').select('*').in('booking_id', bookingIds)) : Promise.resolve({ data: [] }),
  ])

  return {
    supabase,
    dateISO,
    serviceId,
    service,
    shopSettings,
    durationMin,
    bufferMin,
    stepMin: normalizeSlotStep(service.slot_step_min, stepMin),
    requestedLocationId: normalizeOptionalNumber(requestedLocationId),
    requestedStaffId: normalizeOptionalNumber(requestedStaffId),
    resolvedLocationId,
    locationSelectionRequired,
    allowedLocationIds,
    requiredProviderGroupIds,
    staffProviderGroupMap,
    staffList,
    eligibleStaff,
    shifts: shifts || [],
    breaks: breaksRes.data || [],
    timeOffs: timeOffRes.data || [],
    blockedSlots: blockedRes.data || [],
    holidays: holidaysRes.data || [],
    serviceResources: serviceResourcesRes.data || [],
    resources: filterResourceRows({ resources: resourcesRes.data || [], resolvedLocationId }),
    bookings: allBookings,
    allocations: (allocationsRes.data || []).filter((allocation) => String(allocation.booking_id) !== String(excludeBookingId)),
    excludeBookingId,
    ignoreLocationProviderRules,
  }
}

export function evaluatePhase2Availability(context, { requestedStaffId = context.requestedStaffId } = {}) {
  const byStaffShift = new Map((context.shifts || []).map((shift) => [Number(shift.staff_id), shift]))
  const breaksByStaff = buildAvailabilityMaps(context.breaks || [], 'staff_id')
  const timeOffByStaff = buildAvailabilityMaps(
    (context.timeOffs || []).map((row) => (row?.is_all_day ? { ...row, start_time: '00:00', end_time: '23:59' } : row)),
    'staff_id'
  )
  const blockedByStaff = buildAvailabilityMaps(context.blockedSlots || [], 'staff_id')
  const byStaffBookings = buildAvailabilityMaps(context.bookings || [], 'staff_id')

  const staffPool = requestedStaffId
    ? (context.eligibleStaff || []).filter((staff) => Number(staff.id) === Number(requestedStaffId))
    : context.eligibleStaff || []

  const staffAvailability = {}
  const staffSlotMatrix = {}
  const staffDiagnostics = {}
  const summaryTotals = {
    baseAvailableCount: 0,
    finalAvailableCount: 0,
    resourceBlockedCount: 0,
    staffWithBaseAvailability: 0,
    staffWithFinalAvailability: 0,
  }

  for (const staff of staffPool) {
    const providerGroupIds = getStaffProviderGroupIds(staff, context.staffProviderGroupMap)
    const matchedHolidays = (context.holidays || []).filter((holiday) =>
      holidayMatchesScope(holiday, {
        dateISO: context.dateISO,
        locationId: context.resolvedLocationId,
        staffId: staff.id,
        providerGroupIds,
      })
    )

    const baseMatrix = getSlotMatrix({
      staff,
      shift: byStaffShift.get(Number(staff.id)) || null,
      dateISO: context.dateISO,
      shopSettings: context.shopSettings,
      serviceDurationMin: context.durationMin,
      bufferMin: context.bufferMin,
      stepMin: context.stepMin,
      bookings: byStaffBookings.get(Number(staff.id)) || [],
      breaks: breaksByStaff.get(Number(staff.id)) || [],
      timeOffs: timeOffByStaff.get(Number(staff.id)) || [],
      blockedSlots: blockedByStaff.get(Number(staff.id)) || [],
      holidays: matchedHolidays,
    })

    const finalMatrix = !context.ignoreLocationProviderRules && context.locationSelectionRequired
      ? baseMatrix.map((entry) => ({ ...entry, available: false }))
      : baseMatrix.map((entry) => ({
          ...entry,
          available:
            entry.available &&
            hasResourceCapacity({
              slotTime: entry.time,
              bookings: context.bookings,
              allocations: context.allocations,
              resources: context.resources,
              serviceResources: context.serviceResources,
              durationMin: context.durationMin,
              bufferMin: context.bufferMin,
              excludeBookingId: context.excludeBookingId,
            }),
      }))

    const baseBlockedTimes = baseMatrix.filter((entry) => !entry.available).map((entry) => entry.time)
    const baseAvailableCount = baseMatrix.filter((entry) => entry.available).length
    const finalAvailableCount = finalMatrix.filter((entry) => entry.available).length
    const resourceBlockedTimes = finalMatrix
      .filter((entry) => !entry.available && baseMatrix.find((baseEntry) => baseEntry.time === entry.time)?.available)
      .map((entry) => entry.time)

    staffAvailability[staff.id] = finalMatrix.filter((entry) => entry.available).map((entry) => entry.time)
    staffSlotMatrix[staff.id] = finalMatrix
    staffDiagnostics[staff.id] = {
      holidayBlocked: matchedHolidays.length > 0,
      baseBlockedTimes,
      resourceBlockedTimes,
    }
    summaryTotals.baseAvailableCount += baseAvailableCount
    summaryTotals.finalAvailableCount += finalAvailableCount
    summaryTotals.resourceBlockedCount += resourceBlockedTimes.length
    if (baseAvailableCount > 0) summaryTotals.staffWithBaseAvailability += 1
    if (finalAvailableCount > 0) summaryTotals.staffWithFinalAvailability += 1
  }

  const mergedMap = new Map()
  for (const matrix of Object.values(staffSlotMatrix)) {
    for (const entry of matrix) {
      const current = mergedMap.get(entry.time)
      mergedMap.set(entry.time, {
        time: entry.time,
        available: Boolean(current?.available || entry.available),
      })
    }
  }

  const slots = Array.from(new Set(Object.values(staffAvailability).flat())).sort()
  const dateSummaryStatus = !context.ignoreLocationProviderRules && context.locationSelectionRequired
    ? 'location_required'
    : summaryTotals.finalAvailableCount > 0
      ? 'open'
      : summaryTotals.baseAvailableCount > 0
        ? 'full'
        : 'closed'

  return {
    locationId: context.resolvedLocationId,
    locationSelectionRequired: context.locationSelectionRequired,
    ignoreLocationProviderRules: Boolean(context.ignoreLocationProviderRules),
    requestedStaffEligible: !requestedStaffId || staffPool.length > 0,
    staffAvailability,
    staffSlotMatrix,
    slotMatrix: Array.from(mergedMap.values()).sort((a, b) => a.time.localeCompare(b.time)),
    slots,
    staffDiagnostics,
    dateSummary: {
      status: dateSummaryStatus,
      locationSelectionRequired: context.locationSelectionRequired,
      hasWorkingSlots: summaryTotals.baseAvailableCount > 0,
      hasAvailableSlots: summaryTotals.finalAvailableCount > 0,
      availableCount: summaryTotals.finalAvailableCount,
      workingCount: summaryTotals.baseAvailableCount,
      blockedCount: Math.max(summaryTotals.baseAvailableCount - summaryTotals.finalAvailableCount, 0),
      resourceBlockedCount: summaryTotals.resourceBlockedCount,
      staffWithWorkingSlots: summaryTotals.staffWithBaseAvailability,
      staffWithAvailableSlots: summaryTotals.staffWithFinalAvailability,
    },
  }
}

export function validatePhase2Selection(context, { startTime, requestedStaffId = context.requestedStaffId } = {}) {
  if (!startTime) {
    throw new Phase2Error('Please choose a time slot.', { code: 'missing_start_time', status: 400 })
  }

  const evaluation = evaluatePhase2Availability(context, { requestedStaffId })
  const requestedStaffPool = requestedStaffId
    ? (context.eligibleStaff || []).filter((staff) => Number(staff.id) === Number(requestedStaffId))
    : context.eligibleStaff || []

  let chosenStaff = null
  for (const staff of requestedStaffPool) {
    if ((evaluation.staffAvailability[staff.id] || []).includes(startTime)) {
      chosenStaff = staff
      break
    }
  }

  if (!chosenStaff) {
    const conflict = summarizeConflict({ requestedStaffId, evaluation, startTime })
    throw new Phase2Error(conflict.message, conflict)
  }

  return {
    chosenStaff,
    chosenStaffId: chosenStaff.id,
    evaluation,
  }
}

export const buildBookingTiming = ({ dateISO, startTime, durationMin, bufferMin }) => {
  const endTime = addMinutesToTime(startTime, durationMin)
  const bufferEndTime = addMinutesToTime(endTime, bufferMin)

  return {
    start_time: startTime,
    end_time: endTime,
    buffer_end_time: bufferEndTime,
    start_at: timeToHKTimestamp(dateISO, startTime),
    end_at: addMinutesToHKTimestamp(dateISO, startTime, durationMin),
    buffer_end_at: addMinutesToHKTimestamp(dateISO, startTime, durationMin + bufferMin),
    duration_min: durationMin,
    buffer_min: bufferMin,
  }
}

export const buildResourceAllocationPayload = ({ bookingId, serviceResources = [] }) =>
  (serviceResources || []).map((requirement) => ({
    booking_id: bookingId,
    resource_id: requirement.resource_id,
    quantity: Number(requirement.quantity || 1),
  }))

export function buildBookingPayload({
  existingBooking = null,
  user,
  service,
  dateISO,
  startTime,
  chosenStaff,
  durationMin,
  bufferMin,
  locationId = null,
  providerGroupId = null,
  customerName = '',
  customerPhone = '',
  coupon = null,
  userTicketId = null,
  finalPrice = 0,
  servicePrice = 0,
  status = 'pending',
}) {
  return {
    ...(existingBooking ? {} : { ref: `${Date.now()}` }),
    service: service.name,
    service_price: servicePrice,
    final_price: finalPrice,
    date: toLegacyDate(dateISO),
    time: startTime,
    staff_id: chosenStaff.id,
    staff_name: chosenStaff.name,
    name: customerName,
    phone: customerPhone,
    coupon: coupon || null,
    user_ticket_id: userTicketId || null,
    status,
    user_id: existingBooking?.user_id || user?.id,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: existingBooking?.customer_email || user?.email || null,
    service_id: service.id,
    location_id: locationId,
    provider_group_id: providerGroupId,
    appointment_date: dateISO,
    ...buildBookingTiming({ dateISO, startTime, durationMin, bufferMin }),
  }
}
