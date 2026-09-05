import { getWorkingWindow } from '../../../lib/booking/availability'
import {
  getNumberSetting,
  evaluatePhase2Availability,
  getStaffProviderGroupIds,
  holidayMatchesScope,
  loadPhase2Context,
  normalizeOptionalNumber,
  Phase2Error,
  safeSelect,
  settingsToMap,
  staffCanDoService,
  staffMatchesLocation,
  staffMatchesProviderGroups,
  toLegacyDate,
} from '../../../lib/booking/phase2'

const MAX_DAYS = 31
const DEFAULT_DAYS = 14
const HK_TIME_ZONE = 'Asia/Hong_Kong'
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_SUMMARY_CACHE_TTL_MS = 30 * 1000
const OPTIONAL_SERVICE_COLUMNS = ['buffer_min', 'slot_step_min', 'min_booking_qty', 'max_booking_qty', 'booking_mode']
const monthSummaryCache = new Map()

export const normalizeDateISO = (value) => {
  const text = String(value || '').trim()
  return ISO_DATE_RE.test(text) ? text : ''
}

export const getTodayISO = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: HK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

export const addDays = (dateISO, offset) => {
  const date = new Date(`${dateISO}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const parseOptionalNumber = (value) => {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const hasMissingOptionalServiceColumn = (message = '') =>
  OPTIONAL_SERVICE_COLUMNS.some((column) => String(message).includes(column))

export const resolveMonthReferenceISO = ({ startDate, year, month } = {}) => {
  const normalizedStartDate = normalizeDateISO(startDate)
  if (normalizedStartDate) return normalizedStartDate

  const parsedYear = parsePositiveInt(year, null)
  const parsedMonth = parsePositiveInt(month, null)
  if (parsedYear && parsedMonth && parsedMonth >= 1 && parsedMonth <= 12) {
    return `${String(parsedYear).padStart(4, '0')}-${String(parsedMonth).padStart(2, '0')}-01`
  }

  return getTodayISO()
}

export const getMonthWindow = (referenceDateISO) => {
  const normalizedReference = normalizeDateISO(referenceDateISO) || getTodayISO()
  const [yearText, monthText] = normalizedReference.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const monthStartISO = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`
  const monthEndDate = new Date(Date.UTC(year, month, 0))
  const monthEndISO = monthEndDate.toISOString().slice(0, 10)
  const daysInMonth = monthEndDate.getUTCDate()

  return {
    monthStartISO,
    monthEndISO,
    daysInMonth,
  }
}

const buildMonthSummaryCacheKey = ({ referenceDateISO, serviceId, staffId, locationId, cacheVersion, ignoreLocationProviderRules = false }) =>
  [referenceDateISO, serviceId, staffId, locationId || 'none', cacheVersion || 'v0', ignoreLocationProviderRules ? 'public' : 'strict'].join(':')

const readCachedMonthSummary = (cacheKey) => {
  const cached = monthSummaryCache.get(cacheKey)
  if (!cached) return null
  if (Date.now() - cached.createdAt > MONTH_SUMMARY_CACHE_TTL_MS) {
    monthSummaryCache.delete(cacheKey)
    return null
  }
  return cached.value
}

const writeCachedMonthSummary = (cacheKey, value) => {
  monthSummaryCache.set(cacheKey, {
    createdAt: Date.now(),
    value,
  })
}

const filterResourceRows = ({ resources = [], resolvedLocationId }) =>
  (resources || []).filter(
    (resource) =>
      resource?.enabled !== false &&
      (!resolvedLocationId || !resource?.location_id || Number(resource.location_id) === Number(resolvedLocationId)),
  )

const groupRowsByDate = (rows = [], key = 'date') => {
  const map = new Map()
  for (const row of rows || []) {
    const dateISO = normalizeDateISO(row?.[key] || row?.appointment_date)
    if (!dateISO) continue
    if (!map.has(dateISO)) map.set(dateISO, [])
    map.get(dateISO).push(row)
  }
  return map
}

const buildMonthlyContext = async ({
  supabase,
  monthStartISO,
  monthEndISO,
  serviceId,
  requestedStaffId,
  requestedLocationId,
  ignoreLocationProviderRules = false,
}) => {
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
    safeSelect(supabase.from('service_locations').select('id,service_id,location_id,enabled').eq('service_id', serviceId)),
    safeSelect(supabase.from('service_provider_groups').select('id,service_id,provider_group_id,assignment_mode').eq('service_id', serviceId)),
    safeSelect(supabase.from('staff_provider_groups').select('staff_id,provider_group_id')),
    safeSelect(supabase.from('holidays').select('id,holiday_date,end_date,location_id,staff_id,provider_group_id,is_closed').lte('holiday_date', monthEndISO)),
    safeSelect(supabase.from('service_resources').select('id,service_id,resource_id,quantity,required').eq('service_id', serviceId)),
  ])

  const service = serviceRes.data
  const shopSettings = settingsToMap(settingsRes.data)
  const durationMin = Number(service.time) || 60
  const defaultBufferMin = getNumberSetting(shopSettings, 'default_buffer_min', 15)
  const bufferMin = Number.isFinite(Number(service.buffer_min)) ? Number(service.buffer_min) : defaultBufferMin
  const stepMin = getNumberSetting(shopSettings, 'slot_step_min', 15)
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

  const staffProviderGroupMap = new Map()
  for (const row of staffProviderGroupsRes.data || []) {
    const staffId = normalizeOptionalNumber(row?.staff_id)
    const groupId = normalizeOptionalNumber(row?.provider_group_id)
    if (!staffId || !groupId) continue
    if (!staffProviderGroupMap.has(staffId)) staffProviderGroupMap.set(staffId, new Set())
    staffProviderGroupMap.get(staffId).add(groupId)
  }

  const staffSelect = 'id,name,enabled,role,services,schedule,daysOff,location_id,provider_group_id'
  const buildStaffQuery = () => supabase.from('staff').select(staffSelect).eq('enabled', true).order('name')
  const staffRes = requestedStaffId ? await buildStaffQuery().eq('id', requestedStaffId) : await buildStaffQuery()
  if (staffRes.error) {
    throw new Phase2Error(staffRes.error.message, { code: 'staff_load_failed', status: 500 })
  }

  const staffList = staffRes.data || []
  const eligibleStaff = staffList.filter(
    (staff) =>
      staffCanDoService(staff, serviceId) &&
      (ignoreLocationProviderRules || staffMatchesLocation(staff, resolvedLocationId)) &&
      (ignoreLocationProviderRules || staffMatchesProviderGroups(staff, requiredProviderGroupIds, staffProviderGroupMap)),
  )
  const staffIds = staffList.map((staff) => Number(staff.id)).filter(Number.isFinite)

  const legacyMonthDates = Array.from({ length: getMonthWindow(monthStartISO).daysInMonth }, (_, index) => toLegacyDate(addDays(monthStartISO, index)))

  const [shiftsRes, breaksRes, timeOffRes, blockedRes, bookingsResult] = await Promise.all([
    staffIds.length
      ? safeSelect(
          supabase
            .from('staff_shifts')
            .select('id,staff_id,date,start_time,end_time,is_off')
            .gte('date', monthStartISO)
            .lte('date', monthEndISO)
            .in('staff_id', staffIds),
        )
      : Promise.resolve({ data: [] }),
    staffIds.length
      ? safeSelect(supabase.from('staff_breaks').select('id,staff_id,day_of_week,start_time,end_time,enabled').in('staff_id', staffIds))
      : Promise.resolve({ data: [] }),
    staffIds.length
      ? safeSelect(
          supabase
            .from('staff_time_off')
            .select('id,staff_id,date,start_time,end_time')
            .gte('date', monthStartISO)
            .lte('date', monthEndISO)
            .in('staff_id', staffIds),
        )
      : Promise.resolve({ data: [] }),
    staffIds.length
      ? safeSelect(
          supabase
            .from('blocked_slots')
            .select('id,staff_id,date,start_time,end_time')
            .gte('date', monthStartISO)
            .lte('date', monthEndISO)
            .in('staff_id', staffIds),
        )
      : Promise.resolve({ data: [] }),
    (async () => {
      const result = await supabase
        .from('bookings')
        .select('id,staff_id,status,start_time,end_time,buffer_end_time,duration_min,buffer_min,time,appointment_date,date,location_id,provider_group_id')
        .gte('appointment_date', monthStartISO)
        .lte('appointment_date', monthEndISO)
      if (!result.error) return result
      if (String(result.error.message || '').includes('appointment_date')) {
        return supabase
          .from('bookings')
          .select('id,staff_id,status,start_time,end_time,buffer_end_time,duration_min,buffer_min,time,appointment_date,date,location_id,provider_group_id')
          .in('date', legacyMonthDates)
      }
      return result
    })(),
  ])

  if (bookingsResult.error) {
    throw new Phase2Error(bookingsResult.error.message, { code: 'booking_load_failed', status: 500 })
  }

  const bookings = bookingsResult.data || []
  const bookingIds = bookings.map((booking) => booking.id).filter(Boolean)
  const resourceIds = (serviceResourcesRes.data || []).map((row) => Number(row.resource_id)).filter(Number.isFinite)
  const [resourcesRes, allocationsRes] = await Promise.all([
    resourceIds.length > 0
      ? safeSelect(supabase.from('resources').select('id,name,location_id,enabled,capacity').in('id', resourceIds))
      : Promise.resolve({ data: [] }),
    bookingIds.length > 0
      ? safeSelect(supabase.from('booking_resource_allocations').select('id,booking_id,resource_id,quantity').in('booking_id', bookingIds))
      : Promise.resolve({ data: [] }),
  ])

  return {
    serviceId,
    service,
    shopSettings,
    durationMin,
    bufferMin,
    stepMin: Number(service.slot_step_min) > 0 ? Number(service.slot_step_min) : stepMin,
    requestedLocationId: normalizeOptionalNumber(requestedLocationId),
    requestedStaffId: normalizeOptionalNumber(requestedStaffId),
    resolvedLocationId,
    locationSelectionRequired,
    allowedLocationIds,
    requiredProviderGroupIds,
    staffProviderGroupMap,
    staffList,
    eligibleStaff,
    holidays: holidaysRes.data || [],
    serviceResources: serviceResourcesRes.data || [],
    resources: filterResourceRows({ resources: resourcesRes.data || [], resolvedLocationId }),
    shiftsByDate: groupRowsByDate(shiftsRes.data || []),
    timeOffByDate: groupRowsByDate(timeOffRes.data || []),
    blockedByDate: groupRowsByDate(blockedRes.data || []),
    bookingsByDate: groupRowsByDate(bookings),
    allocationsByBooking: (allocationsRes.data || []).reduce((map, row) => {
      const bookingId = row?.booking_id
      if (!bookingId) return map
      if (!map.has(bookingId)) map.set(bookingId, [])
      map.get(bookingId).push(row)
      return map
    }, new Map()),
    breaks: breaksRes.data || [],
    ignoreLocationProviderRules,
  }
}

const buildDateSummaryFromMonthlyContext = ({ monthlyContext, dateISO, staffId }) => {
  const staff =
    (monthlyContext.eligibleStaff || []).find((row) => Number(row.id) === Number(staffId)) ||
    (monthlyContext.staffList || []).find((row) => Number(row.id) === Number(staffId)) ||
    null

  if (!staff) {
    return {
      date: dateISO,
      status: 'off',
      hasWorkingHours: false,
      hasAvailableSlots: false,
      availableCount: 0,
      slotCount: 0,
      reason: 'staff_unavailable',
    }
  }

  const context = {
    ...monthlyContext,
    dateISO,
    shifts: monthlyContext.shiftsByDate.get(dateISO) || [],
    breaks: monthlyContext.breaks || [],
    timeOffs: monthlyContext.timeOffByDate.get(dateISO) || [],
    blockedSlots: monthlyContext.blockedByDate.get(dateISO) || [],
    bookings: monthlyContext.bookingsByDate.get(dateISO) || [],
    allocations: (monthlyContext.bookingsByDate.get(dateISO) || []).flatMap((booking) => monthlyContext.allocationsByBooking.get(booking.id) || []),
    excludeBookingId: null,
  }

  const providerGroupIds = getStaffProviderGroupIds(staff, context.staffProviderGroupMap)
  const matchedHolidays = (context.holidays || []).filter((holiday) =>
    holidayMatchesScope(holiday, {
      dateISO,
      locationId: context.resolvedLocationId,
      staffId: staff.id,
      providerGroupIds,
    }),
  )

  const shift = (context.shifts || []).find((row) => Number(row.staff_id) === Number(staff.id)) || null
  const workingWindow = getWorkingWindow({
    staff,
    shift,
    dateISO,
    shopSettings: context.shopSettings,
    holidays: matchedHolidays,
  })

  const evaluation = evaluatePhase2Availability(context, { requestedStaffId: staff.id })
  const slotMatrix = Array.isArray(evaluation.staffSlotMatrix?.[staff.id]) ? evaluation.staffSlotMatrix[staff.id] : []
  const uniqueSlotMap = new Map()
  for (const entry of slotMatrix) {
    const time = String(entry?.time || '')
    if (!time) continue
    const current = uniqueSlotMap.get(time)
    uniqueSlotMap.set(time, {
      time,
      available: Boolean(current?.available || entry?.available),
    })
  }
  const uniqueSlots = Array.from(uniqueSlotMap.values())
  const availableCount = uniqueSlots.filter((entry) => entry?.available).length
  const dateSummary = evaluation.dateSummary || {}
  const workingCount = Number(dateSummary.workingCount || 0)
  const resourceBlockedCount = Number(dateSummary.resourceBlockedCount || 0)
  const hasWorkingHours =
    Boolean(workingWindow) &&
    Number.isFinite(workingWindow?.startMin) &&
    Number.isFinite(workingWindow?.endMin) &&
    workingWindow.startMin < workingWindow.endMin

  const reason = !hasWorkingHours
    ? 'off'
    : !monthlyContext.ignoreLocationProviderRules && !evaluation.locationSelectionRequired && !evaluation.requestedStaffEligible
      ? 'provider_mismatch'
      : !monthlyContext.ignoreLocationProviderRules && evaluation.locationSelectionRequired
        ? 'location_required'
        : availableCount > 0
          ? 'available'
          : resourceBlockedCount > 0
            ? 'resource_full'
            : workingCount > 0
              ? 'fully_booked'
              : 'no_bookable_slots'

  return {
    date: dateISO,
    status: reason === 'off' ? 'off' : availableCount > 0 ? 'available' : 'full',
    hasWorkingHours,
    hasAvailableSlots: availableCount > 0,
    availableCount,
    slotCount: uniqueSlots.length,
    reason,
  }
}

export const buildDateSummary = async ({ supabase, dateISO, serviceId, staffId, locationId, ignoreLocationProviderRules = false }) => {
  const context = await loadPhase2Context({
    supabase,
    dateISO,
    serviceId,
    requestedLocationId: locationId,
    requestedStaffId: staffId,
    ignoreLocationProviderRules,
  })

  const staff =
    (context.eligibleStaff || []).find((row) => Number(row.id) === Number(staffId)) ||
    (context.staffList || []).find((row) => Number(row.id) === Number(staffId)) ||
    null

  if (!staff) {
    return {
      date: dateISO,
      status: 'off',
      hasWorkingHours: false,
      hasAvailableSlots: false,
      availableCount: 0,
      slotCount: 0,
      reason: 'staff_unavailable',
    }
  }

  const providerGroupIds = getStaffProviderGroupIds(staff, context.staffProviderGroupMap)
  const matchedHolidays = (context.holidays || []).filter((holiday) =>
    holidayMatchesScope(holiday, {
      dateISO,
      locationId: context.resolvedLocationId,
      staffId: staff.id,
      providerGroupIds,
    }),
  )

  const shift = (context.shifts || []).find((row) => Number(row.staff_id) === Number(staff.id)) || null
  const workingWindow = getWorkingWindow({
    staff,
    shift,
    dateISO,
    shopSettings: context.shopSettings,
    holidays: matchedHolidays,
  })

  const evaluation = evaluatePhase2Availability(context, { requestedStaffId: staff.id })
  const slotMatrix = Array.isArray(evaluation.staffSlotMatrix?.[staff.id]) ? evaluation.staffSlotMatrix[staff.id] : []
  const uniqueSlotMap = new Map()
  for (const entry of slotMatrix) {
    const time = String(entry?.time || '')
    if (!time) continue
    const current = uniqueSlotMap.get(time)
    uniqueSlotMap.set(time, {
      time,
      available: Boolean(current?.available || entry?.available),
    })
  }
  const uniqueSlots = Array.from(uniqueSlotMap.values())
  const availableCount = uniqueSlots.filter((entry) => entry?.available).length
  const dateSummary = evaluation.dateSummary || {}
  const workingCount = Number(dateSummary.workingCount || 0)
  const resourceBlockedCount = Number(dateSummary.resourceBlockedCount || 0)
  const hasWorkingHours =
    Boolean(workingWindow) &&
    Number.isFinite(workingWindow?.startMin) &&
    Number.isFinite(workingWindow?.endMin) &&
    workingWindow.startMin < workingWindow.endMin

  const reason = !hasWorkingHours
    ? 'off'
    : !ignoreLocationProviderRules && !evaluation.locationSelectionRequired && !evaluation.requestedStaffEligible
      ? 'provider_mismatch'
      : !ignoreLocationProviderRules && evaluation.locationSelectionRequired
        ? 'location_required'
        : availableCount > 0
          ? 'available'
          : resourceBlockedCount > 0
            ? 'resource_full'
            : workingCount > 0
              ? 'fully_booked'
              : 'no_bookable_slots'

  return {
    date: dateISO,
    status: reason === 'off' ? 'off' : availableCount > 0 ? 'available' : 'full',
    hasWorkingHours,
    hasAvailableSlots: availableCount > 0,
    availableCount,
    slotCount: uniqueSlots.length,
    reason,
  }
}

export const buildDateSummaries = async ({
  supabase,
  startDate,
  days = DEFAULT_DAYS,
  serviceId,
  staffId,
  locationId,
  ignoreLocationProviderRules = false,
}) => {
  const normalizedStartDate = normalizeDateISO(startDate) || getTodayISO()
  const safeDays = Math.min(parsePositiveInt(days, DEFAULT_DAYS), MAX_DAYS)
  const dates = await Promise.all(
    Array.from({ length: safeDays }, (_, index) =>
      buildDateSummary({
        supabase,
        dateISO: addDays(normalizedStartDate, index),
        serviceId,
        staffId,
        locationId,
        ignoreLocationProviderRules,
      }),
    ),
  )

  return {
    startDate: normalizedStartDate,
    days: safeDays,
    dates,
  }
}

export const buildMonthSummaries = async ({
  supabase,
  referenceDateISO,
  serviceId,
  staffId,
  locationId,
  cacheVersion,
  ignoreLocationProviderRules = false,
}) => {
  const cacheKey = buildMonthSummaryCacheKey({ referenceDateISO, serviceId, staffId, locationId, cacheVersion, ignoreLocationProviderRules })
  const cached = readCachedMonthSummary(cacheKey)
  if (cached) return cached

  const { monthStartISO, monthEndISO, daysInMonth } = getMonthWindow(referenceDateISO)
  const monthlyContext = await buildMonthlyContext({
    supabase,
    monthStartISO,
    monthEndISO,
    serviceId,
    requestedStaffId: staffId,
    requestedLocationId: locationId,
    ignoreLocationProviderRules,
  })
  const dates = Array.from({ length: daysInMonth }, (_, index) =>
    buildDateSummaryFromMonthlyContext({
      monthlyContext,
      dateISO: addDays(monthStartISO, index),
      staffId,
    }),
  )

  const result = {
    monthStartDate: monthStartISO,
    monthEndDate: monthEndISO,
    daysInMonth,
    startDate: monthStartISO,
    days: daysInMonth,
    cacheVersion: cacheVersion || '',
    dates,
  }

  writeCachedMonthSummary(cacheKey, result)
  return result
}
