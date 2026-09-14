import { createClient } from '@supabase/supabase-js'
import { pathToFileURL } from 'node:url'

const DEFAULT_NAMESPACE = 'e2e_booking_platform'

function fail(message) { throw new Error(`E2E seed refused: ${message}`) }

function required(name) {
  const value = process.env[name]
  if (!value) fail(`${name} is required`)
  return value
}

export function assertE2EUrl(name, value) {
  let url
  try { url = new URL(value) } catch { fail(`${name} must be an absolute URL`) }
  if (!['http:', 'https:'].includes(url.protocol)) fail(`${name} must use http(s)`)
  const host = url.hostname.toLowerCase()
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  const explicitlyE2E = /(^|[.-])(e2e|test)([.-]|$)/.test(host)
  if (!local && !explicitlyE2E) fail(`${name} is not localhost or explicitly named e2e/test (${host})`)
  if (/(^|[.-])(prod|production|preview)([.-]|$)|vercel\.app$/.test(host)) fail(`${name} points at a production or preview host (${host})`)
  return url
}

export function e2eConfig(env = process.env) {
  const namespace = env.E2E_NAMESPACE || DEFAULT_NAMESPACE
  if (!/^[a-z][a-z0-9_]{2,48}$/.test(namespace)) fail('E2E_NAMESPACE must be a lowercase namespace')
  const password = requiredFrom(env, 'E2E_TEST_PASSWORD')
  if (password.length < 12) fail('E2E_TEST_PASSWORD must be at least 12 characters')
  const baseURL = requiredFrom(env, 'E2E_BASE_URL')
  const supabaseUrl = requiredFrom(env, 'E2E_SUPABASE_URL')
  assertE2EUrl('E2E_BASE_URL', baseURL)
  assertE2EUrl('E2E_SUPABASE_URL', supabaseUrl)
  return {
    namespace, password, baseURL, supabaseUrl,
    serviceRoleKey: requiredFrom(env, 'E2E_SUPABASE_SERVICE_ROLE_KEY'),
    databaseMarker: requiredFrom(env, 'E2E_DATABASE_MARKER'),
    customerEmail: env.E2E_CUSTOMER_EMAIL || `${namespace}.customer@example.test`,
    adminEmail: env.E2E_ADMIN_EMAIL || `${namespace}.admin@example.test`,
  }
}

function requiredFrom(env, name) {
  const value = env[name]
  if (!value) fail(`${name} is required`)
  return value
}

function assertResult(result, context) {
  if (result?.error) fail(`${context}: ${result.error.message}`)
  return result?.data
}

async function markedDatabase(db, marker) {
  const settings = assertResult(await db.from('app_settings').select('data').eq('id', 1).maybeSingle(), 'reading app_settings marker')
  if (!settings || settings.data?.e2e_marker !== marker) {
    fail('database marker did not match app_settings.data.e2e_marker; establish it manually in an isolated test database before seeding')
  }
  return settings.data
}

async function listedUsers(db) {
  const response = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (response.error) fail(`listing auth users: ${response.error.message}`)
  return response.data.users || []
}

async function ensureUser(db, { email, password, fullName }) {
  const existing = (await listedUsers(db)).find((user) => user.email?.toLowerCase() === email.toLowerCase())
  if (existing) {
    assertResult(await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { e2e: true, full_name: fullName } }), `updating ${email}`)
    return existing.id
  }
  const created = assertResult(await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { e2e: true, full_name: fullName } }), `creating ${email}`)
  return created.user.id
}

async function deleteRows(query, context) { assertResult(await query, context) }

async function cleanup(db, config, { removeUsers = true } = {}) {
  const prefix = `${config.namespace}%`
  const customers = assertResult(await db.from('customers').select('id').ilike('name', prefix), 'finding namespaced customers') || []
  const customerIds = customers.map((row) => row.id)
  const staff = assertResult(await db.from('staff').select('id').ilike('name', prefix), 'finding namespaced staff') || []
  const staffIds = staff.map((row) => row.id)
  const packages = assertResult(await db.from('packages').select('id').ilike('name', prefix), 'finding namespaced packages') || []
  const packageIds = packages.map((row) => row.id)

  if (customerIds.length) {
    const packageRows = assertResult(await db.from('customer_packages').select('id').in('customer_id', customerIds), 'finding customer packages') || []
    const packageRowsIds = packageRows.map((row) => row.id)
    if (packageRowsIds.length) await deleteRows(db.from('package_redemptions').delete().in('customer_package_id', packageRowsIds), 'deleting package redemptions')
    await deleteRows(db.from('appointments').delete().in('customer_id', customerIds), 'deleting customer appointments')
    await deleteRows(db.from('customer_packages').delete().in('customer_id', customerIds), 'deleting customer packages')
    await deleteRows(db.from('customers').delete().in('id', customerIds), 'deleting customers')
  }
  await deleteRows(db.from('appointments').delete().ilike('customer_name', prefix), 'deleting guest appointments')
  if (staffIds.length) {
    await deleteRows(db.from('staff_time_off').delete().in('staff_id', staffIds), 'deleting staff time off')
    await deleteRows(db.from('staff_weekly_hours').delete().in('staff_id', staffIds), 'deleting staff hours')
    await deleteRows(db.from('staff_services').delete().in('staff_id', staffIds), 'deleting staff services')
    await deleteRows(db.from('staff').delete().in('id', staffIds), 'deleting staff')
  }
  if (packageIds.length) await deleteRows(db.from('packages').delete().in('id', packageIds), 'deleting packages')
  await deleteRows(db.from('services').delete().ilike('name', prefix), 'deleting services')

  if (removeUsers) {
    const users = await listedUsers(db)
    for (const user of users.filter((row) => [config.customerEmail, config.adminEmail].includes(row.email))) {
      await deleteRows(db.from('admin_users').delete().eq('user_id', user.id), `deleting test administrator ${user.email}`)
      const result = await db.auth.admin.deleteUser(user.id)
      if (result.error) fail(`deleting test auth identity ${user.email}: ${result.error.message}`)
    }
  }
}

async function requireBootstrapAdmin(db, config) {
  const rows = assertResult(await db.from('admin_users').select('user_id').eq('is_active', true), 'checking bootstrap administrator') || []
  const users = await listedUsers(db)
  const testIds = new Set(users.filter((user) => [config.customerEmail, config.adminEmail].includes(user.email)).map((user) => user.id))
  if (!rows.some((row) => !testIds.has(row.user_id))) {
    fail('an isolated database needs one non-test active bootstrap administrator so cleanup never bypasses the final-admin safeguard')
  }
}

async function seed(db, config, settings) {
  await cleanup(db, config)
  await requireBootstrapAdmin(db, config)
  const customerUserId = await ensureUser(db, { email: config.customerEmail, password: config.password, fullName: `${config.namespace} customer` })
  const adminUserId = await ensureUser(db, { email: config.adminEmail, password: config.password, fullName: `${config.namespace} admin` })
  assertResult(await db.from('profiles').upsert({ id: customerUserId, full_name: `${config.namespace} customer`, phone: '61234560' }), 'upserting customer profile')
  assertResult(await db.from('profiles').upsert({ id: adminUserId, full_name: `${config.namespace} admin`, phone: '61234561' }), 'upserting admin profile')
  assertResult(await db.from('admin_users').upsert({ user_id: adminUserId, is_active: true }), 'upserting test administrator')
  const service = assertResult(await db.from('services').insert({ name: `${config.namespace} 創意剪髮`, price: 88000, duration_minutes: 60, category: 'E2E', enabled: true, published: true, sort_order: -10000 }).select().single(), 'creating service')
  const staff = assertResult(await db.from('staff').insert([
    { name: `${config.namespace} staff_a`, display_name: `${config.namespace} 員工 A`, colour_hex: '#1255aa', is_active: true, sort_order: -10000 },
    { name: `${config.namespace} staff_b`, display_name: `${config.namespace} 員工 B`, colour_hex: '#22aa55', is_active: true, sort_order: -9999 },
  ]).select(), 'creating staff')
  assertResult(await db.from('staff_services').insert(staff.map((person) => ({ staff_id: person.id, service_id: service.id }))), 'linking staff services')
  assertResult(await db.from('staff_weekly_hours').insert(staff.flatMap((person) => Array.from({ length: 7 }, (_, weekday) => ({ staff_id: person.id, weekday, is_working: true, starts_at: '10:00', ends_at: '19:00' })))), 'creating staff schedules')
  assertResult(await db.from('business_hours').upsert(Array.from({ length: 7 }, (_, weekday) => ({ weekday, is_open: true, opens_at: '10:00', closes_at: '19:00' }))), 'setting business hours')
  const customer = assertResult(await db.from('customers').insert({ name: `${config.namespace} customer`, phone: '61234560', email: config.customerEmail, user_id: customerUserId }).select().single(), 'creating customer')
  const packageRow = assertResult(await db.from('packages').insert({ name: `${config.namespace} 套票`, total_sessions: 2, validity_days: 365, price_hkd: 176000, is_active: true }).select().single(), 'creating package')
  assertResult(await db.from('package_services').insert({ package_id: packageRow.id, service_id: service.id }), 'linking package service')
  assertResult(await db.from('customer_packages').insert({ customer_id: customer.id, package_id: packageRow.id, total_sessions: 2, sessions_remaining: 2, is_active: true, expires_at: new Date(Date.now() + 180 * 86400000).toISOString() }), 'creating customer package')
  assertResult(await db.from('app_settings').update({ data: { ...settings, booking_buffer_minutes: 15, slot_step_minutes: 30, minimum_lead_minutes: 120, maximum_advance_days: 90, cancel_cutoff_hours: 24 } }).eq('id', 1), 'setting deterministic booking policy')
  console.log(`Seeded ${config.namespace}: service=${service.id}; staff=${staff.map((person) => person.id).join(',')}; customer=${customer.id}; package=${packageRow.id}`)
}

async function main() {
  const config = e2eConfig()
  const db = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const settings = await markedDatabase(db, config.databaseMarker)
  const command = process.argv[2] || 'seed'
  if (command === 'seed') await seed(db, config, settings)
  else if (command === 'cleanup') { await requireBootstrapAdmin(db, config); await cleanup(db, config); console.log(`Cleaned ${config.namespace}`) }
  else fail(`unknown command ${command}; use seed or cleanup`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1 })
}
