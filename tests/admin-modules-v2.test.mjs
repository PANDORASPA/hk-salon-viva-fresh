import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { adminId, bookingDatabase } from './helpers/booking-database.mjs'
import { rpcClient } from './helpers/booking-database.mjs'
import { applyPackageAdjustment } from '../lib/admin/package-adjustment.js'
import { mergeSettings } from '../lib/settings/app-settings.js'

const root = new URL('../', import.meta.url)

test('manual package adjustment is atomic, bounded, reasoned, and durably audited', async (t) => {
  const db = await bookingDatabase(t)
  const changed = await db.query(
    'select * from public.admin_adjust_customer_package($1,$2,$3,$4)',
    [adminId, 1, -1, '客人已使用一次但未有預約記錄'],
  )
  assert.equal(changed.rows[0].sessions_remaining, 1)
  assert.equal(changed.rows[0].total_sessions, 2)

  const audit = await db.query("select action, before_data, after_data, metadata from public.admin_audit_logs where action='customer_package.adjust' order by id desc limit 1")
  assert.deepEqual(audit.rows[0].before_data, { sessionsRemaining: 2, totalSessions: 2 })
  assert.deepEqual(audit.rows[0].after_data, { sessionsRemaining: 1, totalSessions: 2 })
  assert.equal(audit.rows[0].metadata.reason, '客人已使用一次但未有預約記錄')

  await assert.rejects(
    db.query('select * from public.admin_adjust_customer_package($1,$2,$3,$4)', [adminId, 1, -2, '']),
    /reason_required|balance_out_of_range/i,
  )
  const unchanged = await db.query('select sessions_remaining, total_sessions from public.customer_packages where id=1')
  assert.deepEqual(unchanged.rows[0], { sessions_remaining: 1, total_sessions: 2 })
})

test('adjustment controller passes only validated explicit values to the audited command', async (t) => {
  const db = await bookingDatabase(t)
  const result = await applyPackageAdjustment(rpcClient(db), adminId, { id: 1, adjustment: -1, reason: '補記一次服務' })
  assert.equal(result.sessions_remaining, 1)
  await assert.rejects(() => applyPackageAdjustment(rpcClient(db), adminId, { id: 1, adjustment: 0, reason: '補回一次服務' }), /調整次數/)
  await assert.rejects(() => applyPackageAdjustment(rpcClient(db), adminId, { id: 1, adjustment: 1, reason: ' ' }), /原因/)
})

test('new admin modules present Traditional Chinese HKD controls and the required mappings', async () => {
  const paths = [
    'app/admin/components/CustomersModule.jsx',
    'app/admin/components/ServicesModule.jsx',
    'app/admin/components/PackagesModule.jsx',
    'app/admin/components/SettingsModule.jsx',
    'app/admin/components/SiteContentModule.jsx',
    'app/admin/components/AdministratorsModule.jsx',
    'app/admin/components/AuditLogModule.jsx',
  ]
  const sources = await Promise.all(paths.map((path) => readFile(new URL(path, root), 'utf8')))
  const joined = sources.join('\n')
  assert.match(joined, /HK\$/)
  assert.match(joined, /serviceIds/)
  assert.match(joined, /sessions_remaining|sessionsRemaining/)
  assert.match(joined, /取消期限/)
  assert.doesNotMatch(joined, /£|Price in pence|Loading…/)
})

test('admin price presentation converts HKD dollars and stored cents without rounding drift', async () => {
  const { fromHkdInput, toHkdInput } = await import('../app/admin/components/price-hkd.js')
  assert.equal(toHkdInput(28000), '280')
  assert.equal(fromHkdInput('280'), 28000)
  assert.equal(fromHkdInput('280.5'), 28050)
  assert.equal(fromHkdInput('280.555'), null)
})

test('settings merge preserves bounded booking availability controls', () => {
  const settings = mergeSettings({ slot_step_minutes: 15, minimum_lead_minutes: 90, maximum_advance_days: 120, cancel_cutoff_hours: 12 })
  assert.deepEqual(
    { slot_step_minutes: settings.slot_step_minutes, minimum_lead_minutes: settings.minimum_lead_minutes, maximum_advance_days: settings.maximum_advance_days, cancel_cutoff_hours: settings.cancel_cutoff_hours },
    { slot_step_minutes: 15, minimum_lead_minutes: 90, maximum_advance_days: 120, cancel_cutoff_hours: 12 },
  )
  assert.equal(mergeSettings({ slot_step_minutes: 7 }).slot_step_minutes, 30)
})

test('package command replaces eligible services and writes one audited before/after mutation', async (t) => {
  const db = await bookingDatabase(t)
  const saved = await db.query('select * from public.admin_save_package($1,$2,$3,$4,$5,$6,$7,$8,$9)', [adminId, null, '加強套票', '#a98152', '說明', 3, 365, 28000, [1]])
  assert.equal(saved.rows[0].price_hkd, 28000)
  const mapping = await db.query('select service_id from public.package_services where package_id=$1', [saved.rows[0].id])
  assert.deepEqual(mapping.rows, [{ service_id: 1 }])
  const audit = await db.query("select before_data, after_data from public.admin_audit_logs where action='package.create' order by id desc limit 1")
  assert.equal(audit.rows[0].before_data, null)
  assert.equal(audit.rows[0].after_data.name, '加強套票')
})

test('customer detail controller ignores delayed customer A after customer B was selected', async () => {
  const { createCustomerDetailController } = await import('../app/admin/components/customer-detail-controller.js')
  const pending = new Map(); const snapshots = []
  const controller = createCustomerDetailController({
    load: (id, signal) => new Promise((resolve, reject) => { pending.set(id, { resolve, reject, signal }) }),
    publish: value => snapshots.push(value),
  })
  controller.select(1); controller.select(2)
  pending.get(2).resolve({ id: 2, name: 'B' }); await new Promise(resolve => setImmediate(resolve))
  pending.get(1).resolve({ id: 1, name: 'A' }); await new Promise(resolve => setImmediate(resolve))
  assert.equal(snapshots.at(-1).detail.id, 2)
  assert.equal(snapshots.at(-1).draftCustomerId, 2)
})

test('customer detail controller scopes a failed request and retry target to the current customer', async () => {
  const { createCustomerDetailController } = await import('../app/admin/components/customer-detail-controller.js')
  const pending = new Map(); const snapshots = []
  const controller = createCustomerDetailController({
    load: (id, signal) => new Promise((resolve, reject) => { pending.set(id, { resolve, reject, signal }) }),
    publish: value => snapshots.push(value),
  })
  controller.select(1); controller.select(2)
  pending.get(1).reject(new Error('A 載入失敗')); await new Promise(resolve => setImmediate(resolve))
  assert.equal(snapshots.at(-1).draftCustomerId, 2)
  assert.equal(snapshots.at(-1).error, '')
  pending.get(2).reject(new Error('B 載入失敗')); await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(snapshots.at(-1), { loading: false, error: 'B 載入失敗', detail: null, draftCustomerId: 2 })
  controller.select(snapshots.at(-1).draftCustomerId)
  pending.get(2).resolve({ id: 2, name: 'B' }); await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(snapshots.at(-1), { loading: false, error: '', detail: { id: 2, name: 'B' }, draftCustomerId: 2 })
})

test('mapping loader blocks save after failure and only latest retry enables it', async () => {
  const { createMappingLoadController } = await import('../app/admin/components/mapping-load-controller.js')
  const pending = []; const states = []
  const controller = createMappingLoadController({ load: signal => new Promise((resolve, reject) => pending.push({ resolve, reject, signal })), publish: state => states.push(state) })
  controller.reload(); pending[0].reject(new Error('載入失敗')); await new Promise(resolve => setImmediate(resolve))
  assert.equal(states.at(-1).error, '載入失敗')
  assert.equal(states.at(-1).ready, false)
  controller.reload(); controller.reload(); pending[1].resolve([{ id: 1 }]); await new Promise(resolve => setImmediate(resolve))
  assert.equal(states.at(-1).ready, false)
  pending[2].resolve([]); await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(states.at(-1), { loading: false, error: '', rows: [], ready: true })
})
