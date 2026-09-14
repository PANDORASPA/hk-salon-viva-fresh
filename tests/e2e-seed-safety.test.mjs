import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { canonicalE2EUrl, e2eConfig } from '../lib/e2e/runtime-preflight.mjs'
import { restoreRuntimeState, snapshotRuntimeState, withRestoration } from '../scripts/seed-e2e.mjs'

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

test('a mismatched snapshot is removed and prevents another project mutation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'booking-e2e-'))
  const file = join(directory, 'runtime-state.json')
  await writeFile(file, JSON.stringify({ origin: 'http://127.0.0.1:59999', marker: 'other', namespace: 'other' }))
  await assert.rejects(
    snapshotRuntimeState({ from: () => { throw new Error('database must not be touched') } }, { ...e2eConfig(valid), runtimeStateFile: file }),
    /stale runtime snapshot belongs to another E2E database or namespace/,
  )
  await assert.rejects(readFile(file, 'utf8'), /ENOENT/)
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
