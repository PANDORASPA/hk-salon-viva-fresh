import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { adminId, bookingDatabase } from './helpers/booking-database.mjs'
import { rpcClient } from './helpers/booking-database.mjs'
import { applyPackageAdjustment } from '../lib/admin/package-adjustment.js'

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
