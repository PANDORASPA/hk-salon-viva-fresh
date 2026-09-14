import assert from 'node:assert/strict'
import test from 'node:test'
import { createE2EProbeHandler } from '../app/api/e2e/route.js'

const markedDb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: { e2e_marker: 'marker' } }, error: null }) }) }) }) }

test('E2E probe denies production and preview runtimes even with a matching marker', async () => {
  for (const runtime of [{ NODE_ENV: 'production' }, { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'preview' }]) {
    const response = await createE2EProbeHandler({ env: { ...runtime, E2E_PROBE_ENABLED: '1', E2E_DATABASE_MARKER: 'marker', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }, getServiceClient: () => markedDb })()
    assert.equal(response.status, 404)
  }
})

test('E2E probe requires an explicit probe flag', async () => {
  const response = await createE2EProbeHandler({ env: { E2E_DATABASE_MARKER: 'marker', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }, getServiceClient: () => markedDb })()
  assert.equal(response.status, 404)
})
