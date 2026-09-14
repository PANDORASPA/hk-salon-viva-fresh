import assert from 'node:assert/strict'
import test from 'node:test'
import { createE2ELauncher } from '../scripts/start-e2e.mjs'

const serviceRoleKeyName = 'SUPABASE_SERVICE_ROLE_KEY'
const serviceRoleKey = 'test-service-key'
const valid = {
  E2E_BASE_URL: 'http://127.0.0.1:3100',
  E2E_SUPABASE_URL: 'http://127.0.0.1:54321',
  E2E_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  E2E_DATABASE_MARKER: 'booking-platform-e2e',
  E2E_TEST_PASSWORD: 'a-long-test-password',
  E2E_PROBE_ENABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
  [serviceRoleKeyName]: serviceRoleKey,
}

test('E2E launcher refuses missing dev probe configuration before spawning', () => {
  assert.throws(() => createE2ELauncher({ env: { ...valid, E2E_PROBE_ENABLED: '' }, spawn: () => { throw new Error('must not spawn') } }), /E2E_PROBE_ENABLED=1/)
})

test('E2E launcher refuses a missing public Supabase key before spawning', () => {
  let spawned = false
  assert.throws(() => createE2ELauncher({ env: { ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }, spawn: () => { spawned = true } }), /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  assert.equal(spawned, false)
})

test('E2E launcher refuses HTTPS loopback before spawning ordinary Next dev', () => {
  let spawned = false
  assert.throws(() => createE2ELauncher({ env: { ...valid, E2E_BASE_URL: 'https://127.0.0.1:3100' }, spawn: () => { spawned = true } }), /must use http/)
  assert.equal(spawned, false)
})

test('E2E launcher starts Next dev with the validated isolated environment', () => {
  const calls = []
  const expectedChild = { once() {} }
  const child = createE2ELauncher({ env: { ...valid }, cwd: 'C:/fixture', spawn: (...args) => { calls.push(args); return expectedChild } })
  assert.equal(child, expectedChild)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1].includes('dev'), true)
  assert.equal(calls[0][1].includes('start'), false)
  assert.equal(calls[0][2].env.E2E_PROBE_ENABLED, '1')
  assert.equal(calls[0][2].env.NEXT_PUBLIC_SUPABASE_URL, valid.E2E_SUPABASE_URL)
})
