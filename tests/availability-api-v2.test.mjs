import assert from 'node:assert/strict'
import test from 'node:test'

const routeFixtures = {
  services: [{ id: 7, duration_minutes: 30, enabled: true, published: true }],
  staff: [
    { id: 1, name: 'Private One', display_name: 'Amy', bio: 'Senior stylist', colour_hex: '#112233', is_active: true, sort_order: 2, created_at: 'private' },
    { id: 2, name: 'Private Two', display_name: 'Bea', bio: null, colour_hex: '#445566', is_active: true, sort_order: 1, updated_at: 'private' },
    { id: 3, name: 'Inactive', display_name: 'Cat', bio: null, colour_hex: '#778899', is_active: false, sort_order: 0 },
  ],
  staff_services: [
    { staff_id: 1, service_id: 7 },
    { staff_id: 2, service_id: 7 },
    { staff_id: 3, service_id: 7 },
    { staff_id: 1, service_id: 8 },
  ],
  staff_weekly_hours: [
    { staff_id: 1, weekday: 3, is_working: true, starts_at: '10:00', ends_at: '12:00' },
    { staff_id: 2, weekday: 3, is_working: true, starts_at: '10:00', ends_at: '12:00' },
  ],
  staff_time_off: [
    { id: 44, staff_id: 2, starts_at: '2026-09-16T10:30:00+08:00', ends_at: '2026-09-16T11:00:00+08:00', reason: 'Private medical reason' },
  ],
  appointments: [
    { id: 55, staff_id: 1, customer_name: 'Private Customer', starts_at: '2026-09-16T10:00:00+08:00', ends_at: '2026-09-16T10:30:00+08:00', occupied_until: '2026-09-16T10:30:00+08:00', status: 'confirmed' },
  ],
  business_hours: [{ weekday: 3, is_open: true, opens_at: '10:00', closes_at: '12:00', updated_at: 'private' }],
  blocked_dates: [],
  app_settings: [{ id: 1, data: { booking_buffer_minutes: 0, slot_step_minutes: 30, minimum_lead_minutes: 0, maximum_advance_days: 90 }, updated_by: 'private' }],
}

function createQueryDatabase(fixtures, { errors = {}, gate } = {}) {
  const started = []
  const queries = []

  class Query {
    constructor(table) {
      this.table = table
      this.columns = '*'
      this.filters = []
      this.orders = []
      this.rowLimit = null
      this.singleMode = false
      queries.push(this)
    }

    select(columns = '*') { this.columns = columns; return this }
    eq(column, value) { this.filters.push(['eq', column, value]); return this }
    neq(column, value) { this.filters.push(['neq', column, value]); return this }
    gt(column, value) { this.filters.push(['gt', column, value]); return this }
    gte(column, value) { this.filters.push(['gte', column, value]); return this }
    lt(column, value) { this.filters.push(['lt', column, value]); return this }
    lte(column, value) { this.filters.push(['lte', column, value]); return this }
    in(column, values) { this.filters.push(['in', column, values]); return this }
    order(column, options = {}) { this.orders.push([column, options]); return this }
    limit(value) { this.rowLimit = value; return this }
    maybeSingle() { this.singleMode = true; return this }

    then(resolve, reject) { return this.execute().then(resolve, reject) }

    async execute() {
      started.push(this.table)
      if (gate) await gate.promise
      if (errors[this.table]) return { data: null, error: errors[this.table] }

      let rows = structuredClone(fixtures[this.table] || [])
      for (const [operator, column, wanted] of this.filters) {
        rows = rows.filter((row) => {
          const actual = row[column]
          if (operator === 'eq') return actual === wanted
          if (operator === 'neq') return actual !== wanted
          if (operator === 'in') return wanted.includes(actual)
          if (operator === 'gt') return actual > wanted
          if (operator === 'gte') return actual >= wanted
          if (operator === 'lt') return actual < wanted
          if (operator === 'lte') return actual <= wanted
          return true
        })
      }
      for (const [column, options] of this.orders.toReversed()) {
        const direction = options.ascending === false ? -1 : 1
        rows.sort((a, b) => direction * String(a[column]).localeCompare(String(b[column]), undefined, { numeric: true }))
      }
      if (this.rowLimit != null) rows = rows.slice(0, this.rowLimit)
      if (this.columns !== '*') {
        const columns = this.columns.split(',').map((column) => column.trim())
        rows = rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])))
      }
      const data = this.singleMode ? (rows[0] || null) : rows
      return { data, error: null }
    }
  }

  return {
    db: { from(table) { return new Query(table) } },
    started,
    queries,
  }
}

function deferred() {
  let release
  const promise = new Promise((resolve) => { release = resolve })
  return { promise, release }
}

async function responseJson(response) {
  return { status: response.status, body: await response.json() }
}

test('maps slot conflicts to the stable public 409 error', async () => {
  // Mutation caught: removing or changing the slot_unavailable mapping.
  const { toBookingHttpError } = await import('../lib/booking/errors.js')
  assert.deepEqual(toBookingHttpError('slot_unavailable'), {
    status: 409,
    code: 'slot_unavailable',
    message: '這個時段剛被預約，請選擇另一個時間。',
  })
})

test('starts every availability source before waiting for any one query', async () => {
  // Mutation caught: replacing Promise.all with sequential awaits or omitting a source.
  const { loadAvailability } = await import('../lib/booking/load-availability.js')
  const gate = deferred()
  const { db, started } = createQueryDatabase(routeFixtures, { gate })
  const pending = loadAvailability({ db, date: '2026-09-16', serviceId: 7, logger: { error() {} } })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(new Set(started), new Set([
    'services', 'staff', 'staff_services', 'staff_weekly_hours', 'staff_time_off',
    'appointments', 'business_hours', 'blocked_dates', 'app_settings',
  ]))
  gate.release()
  await pending
})

test('availability loader selects and returns only scheduling-safe fields', async () => {
  // Mutation caught: selecting private names, customer data, time-off reasons, or timestamps.
  const { loadAvailability } = await import('../lib/booking/load-availability.js')
  const { db } = createQueryDatabase(routeFixtures)
  const loaded = await loadAvailability({ db, date: '2026-09-16', serviceId: 7, logger: { error() {} } })
  assert.deepEqual(loaded.staff.map((person) => Object.keys(person).sort()), [
    ['id', 'is_active', 'service_ids'],
    ['id', 'is_active', 'service_ids'],
  ])
  assert.deepEqual(loaded.timeOff, [{ staff_id: 2, starts_at: '2026-09-16T10:30:00+08:00', ends_at: '2026-09-16T11:00:00+08:00' }])
  assert.deepEqual(loaded.appointments, [{ staff_id: 1, starts_at: '2026-09-16T10:00:00+08:00', occupied_until: '2026-09-16T10:30:00+08:00', status: 'confirmed' }])
  assert.equal(JSON.stringify(loaded).includes('Private'), false)
  assert.equal(JSON.stringify(loaded).includes('reason'), false)
})

test('staff route exposes the exact public projection for a service', async () => {
  // Mutation caught: leaking staff.name/timestamps or returning inactive/unqualified staff.
  const { createStaffHandler } = await import('../app/api/staff/route.js')
  const { db } = createQueryDatabase(routeFixtures)
  const handler = createStaffHandler({ getServiceClient: () => db, logger: { error() {} } })
  assert.deepEqual(await responseJson(await handler(new Request('http://localhost/api/staff?serviceId=7'))), {
    status: 200,
    body: {
      staff: [
        { id: 2, displayName: 'Bea', bio: null, colourHex: '#445566' },
        { id: 1, displayName: 'Amy', bio: 'Senior stylist', colourHex: '#112233' },
      ],
    },
  })
})

test('staff route does not reveal assignments for an unpublished service', async () => {
  // Mutation caught: using service-role staff links without rechecking public service visibility.
  const { createStaffHandler } = await import('../app/api/staff/route.js')
  const fixtures = structuredClone(routeFixtures)
  fixtures.services[0].published = false
  const { db } = createQueryDatabase(fixtures)
  const handler = createStaffHandler({ getServiceClient: () => db, logger: { error() {} } })
  assert.deepEqual(await responseJson(await handler(new Request('http://localhost/api/staff?serviceId=7'))), {
    status: 200,
    body: { staff: [] },
  })
})

test('availability defaults missing staffId to any and returns only safe slot data', async () => {
  // Mutation caught: requiring staffId, skipping any-staff union, or returning loaded rows.
  const { createAvailabilityHandler } = await import('../app/api/availability/route.js')
  const { db } = createQueryDatabase(routeFixtures)
  const handler = createAvailabilityHandler({
    getServiceClient: () => db,
    now: () => new Date('2026-09-14T10:00:00+08:00'),
    logger: { error() {} },
  })
  const result = await responseJson(await handler(new Request('http://localhost/api/availability?date=2026-09-16&serviceId=7')))
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, {
    date: '2026-09-16',
    serviceId: 7,
    staffId: 'any',
    timezone: 'Asia/Hong_Kong',
    slots: [
      { label: '10:00', iso: '2026-09-16T10:00:00+08:00', staffIds: [2] },
      { label: '10:30', iso: '2026-09-16T10:30:00+08:00', staffIds: [1] },
      { label: '11:00', iso: '2026-09-16T11:00:00+08:00', staffIds: [1, 2] },
      { label: '11:30', iso: '2026-09-16T11:30:00+08:00', staffIds: [1, 2] },
    ],
    staffAvailability: {
      1: ['2026-09-16T10:30:00+08:00', '2026-09-16T11:00:00+08:00', '2026-09-16T11:30:00+08:00'],
      2: ['2026-09-16T10:00:00+08:00', '2026-09-16T11:00:00+08:00', '2026-09-16T11:30:00+08:00'],
    },
  })
  assert.equal(JSON.stringify(result.body).includes('Private'), false)
  assert.equal(JSON.stringify(result.body).includes('reason'), false)
})

test('availability limits slots to a positive integer staff preference', async () => {
  // Mutation caught: parsing staffId but ignoring it while calculating slots.
  const { createAvailabilityHandler } = await import('../app/api/availability/route.js')
  const { db } = createQueryDatabase(routeFixtures)
  const handler = createAvailabilityHandler({
    getServiceClient: () => db,
    now: () => new Date('2026-09-14T10:00:00+08:00'),
    logger: { error() {} },
  })
  const result = await responseJson(await handler(new Request('http://localhost/api/availability?date=2026-09-16&serviceId=7&staffId=1')))
  assert.equal(result.status, 200)
  assert.equal(result.body.staffId, 1)
  assert.deepEqual(result.body.slots.map((slot) => slot.label), ['10:30', '11:00', '11:30'])
  assert.deepEqual(result.body.staffAvailability, {
    1: ['2026-09-16T10:30:00+08:00', '2026-09-16T11:00:00+08:00', '2026-09-16T11:30:00+08:00'],
  })
})

for (const staffId of ['0', '-1', '1.5', 'abc', ' ANY ']) {
  test(`availability rejects invalid staffId ${JSON.stringify(staffId)} without querying`, async () => {
    // Mutation caught: permissive Number coercion or case/whitespace normalization of staffId.
    const { createAvailabilityHandler } = await import('../app/api/availability/route.js')
    let requestedDatabase = false
    const handler = createAvailabilityHandler({ getServiceClient() { requestedDatabase = true }, logger: { error() {} } })
    const result = await responseJson(await handler(new Request(`http://localhost/api/availability?date=2026-09-16&serviceId=7&staffId=${encodeURIComponent(staffId)}`)))
    assert.deepEqual(result, {
      status: 400,
      body: { error: '請檢查輸入資料。', code: 'validation_error' },
    })
    assert.equal(requestedDatabase, false)
  })
}

test('staff route rejects an invalid serviceId with the same stable validation error', async () => {
  // Mutation caught: accepting missing, zero, fractional, or non-numeric service IDs.
  const { createStaffHandler } = await import('../app/api/staff/route.js')
  let requestedDatabase = false
  const handler = createStaffHandler({ getServiceClient() { requestedDatabase = true }, logger: { error() {} } })
  const result = await responseJson(await handler(new Request('http://localhost/api/staff?serviceId=0')))
  assert.deepEqual(result, {
    status: 400,
    body: { error: '請檢查輸入資料。', code: 'validation_error' },
  })
  assert.equal(requestedDatabase, false)
})

test('availability logs query detail server-side but returns a sanitized 503', async () => {
  // Mutation caught: swallowing diagnostics or serializing a Supabase error to the public response.
  const { createAvailabilityHandler } = await import('../app/api/availability/route.js')
  const databaseError = { code: 'PGRST999', message: 'secret database detail', hint: 'private hint' }
  const { db } = createQueryDatabase(routeFixtures, { errors: { staff_time_off: databaseError } })
  const logged = []
  const handler = createAvailabilityHandler({
    getServiceClient: () => db,
    now: () => new Date('2026-09-14T10:00:00+08:00'),
    logger: { error(...args) { logged.push(args) } },
  })
  const result = await responseJson(await handler(new Request('http://localhost/api/availability?date=2026-09-16&serviceId=7&staffId=any')))
  assert.deepEqual(result, {
    status: 503,
    body: { error: '暫時無法載入預約資料，請稍後再試。', code: 'availability_unavailable' },
  })
  assert.equal(logged.some((entry) => JSON.stringify(entry).includes('PGRST999')), true)
  assert.equal(JSON.stringify(result.body).includes('PGRST999'), false)
  assert.equal(JSON.stringify(result.body).includes('secret'), false)
})
