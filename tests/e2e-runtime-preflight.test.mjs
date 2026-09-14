import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bindingFor,
  canonicalE2EUrl,
  loadE2EEnvironment,
  runE2ERuntimePreflight,
} from '../lib/e2e/runtime-preflight.mjs'

const env = {
  E2E_BASE_URL: 'http://127.0.0.1:3100',
  E2E_SUPABASE_URL: 'http://127.0.0.1:54321',
  E2E_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  E2E_DATABASE_MARKER: 'booking-platform-e2e',
  E2E_TEST_PASSWORD: 'a-long-test-password',
}

test('canonical E2E URLs normalize case, trailing dots, IDNA, and loopback hosts', () => {
  assert.equal(canonicalE2EUrl(' E2E_BASE_URL ', 'HTTP://LOCALHOST.:3100/').host, 'localhost')
  assert.equal(canonicalE2EUrl('E2E_BASE_URL', 'http://127.23.45.67:3100').host, '127.23.45.67')
  assert.equal(canonicalE2EUrl('E2E_BASE_URL', 'http://[::1]:3100').host, '::1')
  assert.equal(canonicalE2EUrl('E2E_BASE_URL', 'https://tést-e2e.example.').host, 'xn--tst-e2e-bya.example')
})

test('canonical E2E URLs reject production, previews, lookalikes, and public non-test hosts', () => {
  for (const value of ['https://booking-e2e.vercel.app', 'https://prod-e2e.example', 'https://preview-test.example', 'https://contest.example', 'https://booking.example']) {
    assert.throws(() => canonicalE2EUrl('E2E_BASE_URL', value), /E2E preflight refused/)
  }
})

test('runtime preflight verifies marker and application binding before browser navigation', async () => {
  const marker = env.E2E_DATABASE_MARKER
  const service = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: { e2e_marker: marker } }, error: null }) }) }) }) }
  const result = await runE2ERuntimePreflight({
    env,
    createServiceClient: () => service,
    fetchImpl: async () => new Response(JSON.stringify({ e2e: true, binding: bindingFor(marker, canonicalE2EUrl('E2E_SUPABASE_URL', env.E2E_SUPABASE_URL).origin) }), { status: 200 }),
  })
  assert.equal(result.config.baseURL.origin, 'http://127.0.0.1:3100')
  await assert.rejects(() => runE2ERuntimePreflight({
    env,
    createServiceClient: () => service,
    fetchImpl: async () => new Response(JSON.stringify({ e2e: true, binding: 'wrong' }), { status: 200 }),
  }), /application binding does not match/)
})

test('explicit environment loader fills only unset keys and never reports values', () => {
  const target = { E2E_BASE_URL: 'http://127.0.0.1:3100' }
  const loaded = loadE2EEnvironment({ env: target, text: 'E2E_BASE_URL=https://ignored.test\nE2E_DATABASE_MARKER="marker"\nE2E_TEST_PASSWORD=secret' })
  assert.equal(target.E2E_BASE_URL, 'http://127.0.0.1:3100')
  assert.equal(target.E2E_DATABASE_MARKER, 'marker')
  assert.deepEqual(loaded, ['E2E_DATABASE_MARKER', 'E2E_TEST_PASSWORD'])
})
