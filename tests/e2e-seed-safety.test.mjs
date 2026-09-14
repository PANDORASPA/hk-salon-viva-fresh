import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { canonicalE2EUrl, e2eConfig } from '../lib/e2e/runtime-preflight.mjs'
import { cleanupE2EFixtures, restoreRuntimeState, snapshotRuntimeState, withRestoration } from '../scripts/seed-e2e.mjs'

const valid = {
  E2E_BASE_URL: 'http://127.0.0.1:3100',
  E2E_SUPABASE_URL: 'http://127.0.0.1:54321',
  E2E_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  E2E_DATABASE_MARKER: 'booking-platform-e2e',
  E2E_TEST_PASSWORD: 'a-long-test-password',
}

test('E2E seed rejects production and preview targets before connecting', () => {
  assert.throws(() => canonicalE2EUrl('E2E_BASE_URL', 'https://booking.example.com'), /not localhost/)
  assert.throws(() => canonicalE2EUrl('E2E_BASE_URL', 'https://booking-e2e.vercel.app'), /Vercel/)
})

test('E2E seed requires separate credentials and a database marker', () => {
  assert.throws(() => e2eConfig({ ...valid, E2E_DATABASE_MARKER: '' }), /E2E_DATABASE_MARKER is required/)
  assert.deepEqual(e2eConfig(valid).namespace, 'e2e_booking_platform')
})

test('a project B cleanup preserves project A recovery state before any database mutation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'booking-e2e-'))
  const file = join(directory, 'runtime-state.json')
  const projectA = e2eConfig({ ...valid, E2E_SUPABASE_URL: 'http://127.0.0.1:59999', E2E_DATABASE_MARKER: 'project-a-marker' })
  await writeFile(file, JSON.stringify({ origin: projectA.supabaseUrl.origin, marker: projectA.databaseMarker, namespace: projectA.namespace }))
  const noMutation = { from: () => { throw new Error('project B database must not be touched') } }
  await assert.rejects(
    snapshotRuntimeState(noMutation, { ...e2eConfig(valid), runtimeStateFile: file }),
    /runtime snapshot belongs to another E2E database or namespace/,
  )
  await assert.rejects(cleanupE2EFixtures({ db: noMutation, config: { ...e2eConfig(valid), runtimeStateFile: file } }), /runtime snapshot belongs to another E2E database or namespace/)
  assert.equal((await readFile(file, 'utf8')).includes('project-a-marker'), true)
})

test('restore clears every weekday before restoring only the original weekly-hours rows', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'booking-e2e-'))
  const file = join(directory, 'runtime-state.json')
  const config = { ...e2eConfig(valid), runtimeStateFile: file }
  const originalHours = [{ weekday: 2, is_open: false, opens_at: null, closes_at: null }]
  await writeFile(file, JSON.stringify({ origin: config.supabaseUrl.origin, marker: config.databaseMarker, namespace: config.namespace, runId: 'run', businessHours: originalHours, settings: { e2e_marker: config.databaseMarker } }))
  const calls = []
  const db = { from(table) {
    if (table === 'business_hours') return {
      delete: () => ({ not: async () => { calls.push(['delete-all-hours']); return { error: null } } }),
      upsert: async rows => { calls.push(['restore-hours', rows]); return { error: null } },
    }
    return { update: () => ({ eq: async () => { calls.push(['restore-settings']); return { error: null } } }) }
  } }
  await restoreRuntimeState(db, config)
  assert.deepEqual(calls, [['delete-all-hours'], ['restore-hours', originalHours], ['restore-settings']])
  await assert.rejects(readFile(file, 'utf8'), /ENOENT/)
})

test('seed cleanup and state restoration both run when a mutation step fails', async () => {
  const events = []
  await assert.rejects(
    withRestoration(async () => { events.push('mutate'); throw new Error('insert failed') }, async () => { events.push('cleanup'); throw new Error('restore failed') }),
    error => error instanceof AggregateError && error.errors.map(item => item.message).join(' ') === 'insert failed restore failed',
  )
  assert.deepEqual(events, ['mutate', 'cleanup'])
})

test('cleanup removes only fixture issuance keys before their customer package parents', async () => {
  const calls = []
  const config = { ...e2eConfig(valid), runtimeStateFile: join(tmpdir(), 'nonexistent-final-fixture-state.json') }
  const db = {
    auth: { admin: { listUsers: async () => ({ data: { users: [{ id: 'fixture-owner', email: config.customerEmail }] } }), deleteUser: async () => ({ error: null }) } },
    from(table) {
      let remove = false
      const query = {
        select() { return this }, delete() { remove = true; return this },
        eq() { return this },
        in(field, ids) { if (remove) calls.push([table, field, ids]); return this },
        then(resolve, reject) { return Promise.resolve({ error: null, data: remove ? null : ['customers', 'customer_packages'].includes(table) ? [{ id: 17 }] : [] }).then(resolve, reject) },
      }
      return query
    },
  }
  await cleanupE2EFixtures({ db, config, restoreState: false })
  const issuance = calls.findIndex(([table]) => table === 'admin_package_issuances')
  const parent = calls.findIndex(([table]) => table === 'customer_packages')
  assert.ok(issuance >= 0 && issuance < parent)
  assert.deepEqual(calls[issuance], ['admin_package_issuances', 'customer_package_id', [17]])
})
