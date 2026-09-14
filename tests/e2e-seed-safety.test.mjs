import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalE2EUrl, e2eConfig } from '../lib/e2e/runtime-preflight.mjs'

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
