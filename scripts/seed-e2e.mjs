import { readFile, unlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { preflightFailure, runE2ERuntimePreflight } from '../lib/e2e/runtime-preflight.mjs'

const statePath = config => config?.runtimeStateFile || join(process.cwd(), 'e2e', '.runtime-state.json')
const fixture = c => ({ service: c.namespace + ' 創意剪髮', staff: [c.namespace + ' staff_a', c.namespace + ' staff_b'], customer: c.namespace + ' customer', package: c.namespace + ' 套票' })
const ok = (r, m) => { if (r?.error) throw preflightFailure(m); return r?.data }
const ids = rows => rows.map(row => row.id)
const del = async (db, table, field, list, m) => { if (list.length) ok(await db.from(table).delete().in(field, list), m) }
const cleanupNotifications = async (db, c, appointmentIds) => {
  if (appointmentIds.length) ok(await db.rpc('e2e_cleanup_notifications', { p_marker: c.databaseMarker, p_appointment_ids: appointmentIds, p_namespace: c.namespace }), 'could not delete fixture notifications')
}
async function users(db, c) { const r = await db.auth.admin.listUsers({ page: 1, perPage: 1000 }); if (r.error) throw preflightFailure('could not list E2E identities'); return r.data.users.filter(u => [c.customerEmail, c.adminEmail].includes(u.email)) }
const sameSnapshotTarget = (state, c) => state?.origin === c.supabaseUrl.origin && state?.marker === c.databaseMarker && state?.namespace === c.namespace
export async function validateRuntimeSnapshot(c) {
  const file = statePath(c)
  if (!existsSync(file)) return null
  const state = JSON.parse(await readFile(file, 'utf8'))
  // Keep a foreign recovery file intact: it may be the only path to restore
  // that database. Refuse before a delete, insert, or settings mutation.
  if (!sameSnapshotTarget(state, c)) throw preflightFailure('runtime snapshot belongs to another E2E database or namespace')
  return state
}
export async function restoreRuntimeState(db, c) {
  const file = statePath(c)
  if (!existsSync(file)) return
  const state = await validateRuntimeSnapshot(c)
  // Delete first so weekdays absent in the original snapshot remain absent after restoration.
  ok(await db.from('business_hours').delete().not('weekday', 'is', null), 'could not clear business hours')
  if (state.businessHours.length) ok(await db.from('business_hours').upsert(state.businessHours), 'could not restore business hours')
  ok(await db.from('app_settings').update({ data: state.settings }).eq('id', 1), 'could not restore settings')
  await unlink(file)
}
export async function snapshotRuntimeState(db, c) {
  const file = statePath(c)
  if (await validateRuntimeSnapshot(c)) return
  const businessHours = ok(await db.from('business_hours').select('weekday,is_open,opens_at,closes_at'), 'could not snapshot business hours')
  const settings = ok(await db.from('app_settings').select('data').eq('id', 1).single(), 'could not snapshot settings')
  await writeFile(file, JSON.stringify({ origin: c.supabaseUrl.origin, marker: c.databaseMarker, namespace: c.namespace, businessHours, settings: settings.data }), { encoding: 'utf8', mode: 0o600 })
}
export async function withRestoration(mutate, restore) {
  try { return await mutate() } catch (mutationError) {
    try { await restore() } catch (restoreError) {
      if (mutationError) throw new AggregateError([mutationError, restoreError], 'E2E mutation and cleanup both failed')
      throw restoreError
    }
    throw mutationError
  }
}

export async function cleanupE2EFixtures({ db, config, restoreState = true } = {}) {
  await validateRuntimeSnapshot(config)
  let cleanupError
  try {
    const f = fixture(config), u = await users(db, config), userIds = u.map(x => x.id)
    const serviceIds = ids(ok(await db.from('services').select('id').eq('name', f.service), 'could not locate fixture service') || [])
    const staffIds = ids(ok(await db.from('staff').select('id').in('name', f.staff), 'could not locate fixture staff') || [])
    // Auth IDs are authoritative; names can have been edited during a failed fixture run.
    const customerIds = userIds.length ? ids(ok(await db.from('customers').select('id').in('user_id', userIds), 'could not locate fixture customer') || []) : []
    const appointmentIds = serviceIds.length ? ids(ok(await db.from('appointments').select('id').in('service_id', serviceIds), 'could not locate fixture bookings') || []) : []
    const packageIds = ids(ok(await db.from('packages').select('id').eq('name', f.package), 'could not locate fixture package') || [])
    const customerPackageIds = customerIds.length ? ids(ok(await db.from('customer_packages').select('id').in('customer_id', customerIds), 'could not locate fixture packages') || []) : []
    // Notification and audit rows can contain fixture contact data. Both scopes are exact IDs.
    await cleanupNotifications(db, config, appointmentIds); await del(db, 'package_usage_logs', 'appointment_id', appointmentIds, 'could not delete fixture usage logs'); await del(db, 'package_redemptions', 'appointment_id', appointmentIds, 'could not delete fixture redemptions'); await del(db, 'appointments', 'id', appointmentIds, 'could not delete fixture bookings'); await del(db, 'admin_package_issuances', 'customer_package_id', customerPackageIds, 'could not delete fixture issuance keys'); await del(db, 'customer_packages', 'id', customerPackageIds, 'could not delete fixture packages'); await del(db, 'customers', 'id', customerIds, 'could not delete fixture customers'); await del(db, 'staff_time_off', 'staff_id', staffIds, 'could not delete fixture time off'); await del(db, 'staff_weekly_hours', 'staff_id', staffIds, 'could not delete fixture schedules'); await del(db, 'staff_services', 'staff_id', staffIds, 'could not delete fixture mappings'); await del(db, 'staff', 'id', staffIds, 'could not delete fixture staff'); await del(db, 'packages', 'id', packageIds, 'could not delete fixture package'); await del(db, 'services', 'id', serviceIds, 'could not delete fixture service')
    await del(db, 'admin_audit_logs', 'actor_user_id', userIds, 'could not delete fixture audit rows')
    for (const user of u) { await del(db, 'admin_users', 'user_id', [user.id], 'could not delete fixture admin'); if ((await db.auth.admin.deleteUser(user.id)).error) throw preflightFailure('could not delete fixture identity') }
  } catch (error) { cleanupError = error }
  if (restoreState) {
    try { await restoreRuntimeState(db, config) } catch (restoreError) {
      if (cleanupError) throw new AggregateError([cleanupError, restoreError], 'E2E cleanup and restoration both failed')
      throw restoreError
    }
  }
  if (cleanupError) throw cleanupError
}
async function bootstrap(db, c) { const admins = ok(await db.from('admin_users').select('user_id').eq('is_active', true), 'could not check bootstrap admin') || []; const existing = new Set((await users(db, c)).map(x => x.id)); if (!admins.some(x => !existing.has(x.user_id))) throw preflightFailure('a non-test active bootstrap administrator is required') }
async function identity(db, email, password) { const found = (await db.auth.admin.listUsers({ page: 1, perPage: 1000 })).data?.users?.find(x => x.email === email); if (found) { ok(await db.auth.admin.updateUserById(found.id, { password, email_confirm: true }), 'could not update fixture identity'); return found.id }; return ok(await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { e2e: true } }), 'could not create fixture identity').user.id }
export async function seedE2EFixtures({ db, config, settings } = {}) {
  await validateRuntimeSnapshot(config); await cleanupE2EFixtures({ db, config, restoreState: false }); await bootstrap(db, config); await snapshotRuntimeState(db, config)
  return withRestoration(async () => {
  const f = fixture(config), customerUserId = await identity(db, config.customerEmail, config.password), adminUserId = await identity(db, config.adminEmail, config.password)
  ok(await db.from('profiles').upsert([{ id: customerUserId, full_name: f.customer, phone: '61234560' }, { id: adminUserId, full_name: config.namespace + ' admin', phone: '61234561' }]), 'could not create fixture profiles'); ok(await db.from('admin_users').upsert({ user_id: adminUserId, is_active: true }), 'could not create fixture admin')
  const service = ok(await db.from('services').insert({ name: f.service, price: 88000, duration_minutes: 60, category: 'E2E', enabled: true, published: true, sort_order: -10000 }).select().single(), 'could not create fixture service')
  const staff = ok(await db.from('staff').insert([{ name: f.staff[0], display_name: config.namespace + ' 員工 A', colour_hex: '#1255aa', is_active: true, sort_order: -10000 }, { name: f.staff[1], display_name: config.namespace + ' 員工 B', colour_hex: '#22aa55', is_active: true, sort_order: -9999 }]).select(), 'could not create fixture staff')
  ok(await db.from('staff_services').insert(staff.map(p => ({ staff_id: p.id, service_id: service.id }))), 'could not map fixture staff'); ok(await db.from('staff_weekly_hours').insert(staff.flatMap(p => Array.from({ length: 7 }, (_, weekday) => ({ staff_id: p.id, weekday, is_working: true, starts_at: '10:00', ends_at: '19:00' })))), 'could not create fixture schedules'); ok(await db.from('business_hours').upsert(Array.from({ length: 7 }, (_, weekday) => ({ weekday, is_open: true, opens_at: '10:00', closes_at: '19:00' }))), 'could not set fixture business hours')
  const customer = ok(await db.from('customers').insert({ name: f.customer, phone: '61234560', email: config.customerEmail, user_id: customerUserId }).select().single(), 'could not create fixture customer'); const pack = ok(await db.from('packages').insert({ name: f.package, total_sessions: 2, validity_days: 365, price_hkd: 176000, is_active: true }).select().single(), 'could not create fixture package'); ok(await db.from('package_services').insert({ package_id: pack.id, service_id: service.id }), 'could not map fixture package'); ok(await db.from('customer_packages').insert({ customer_id: customer.id, package_id: pack.id, total_sessions: 2, sessions_remaining: 2, is_active: true, expires_at: new Date(Date.now() + 180 * 86400000).toISOString() }), 'could not create fixture package balance'); ok(await db.from('app_settings').update({ data: { ...settings, booking_buffer_minutes: 15, slot_step_minutes: 30, minimum_lead_minutes: 120, maximum_advance_days: 90, cancel_cutoff_hours: 24 } }).eq('id', 1), 'could not set fixture settings')
  }, () => cleanupE2EFixtures({ db, config, restoreState: true }))
}
export async function prepareE2EFixtures() { const r = await runE2ERuntimePreflight(); await seedE2EFixtures(r); return r.config }
export async function finalCleanupE2EFixtures() { const r = await runE2ERuntimePreflight(); await cleanupE2EFixtures({ db: r.db, config: r.config }) }
async function main() { if ((process.argv[2] || 'seed') === 'seed') await prepareE2EFixtures(); else if (process.argv[2] === 'cleanup') await finalCleanupE2EFixtures(); else throw preflightFailure('unknown command') }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1 })
