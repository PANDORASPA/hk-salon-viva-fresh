import assert from 'node:assert/strict'
import test from 'node:test'

import { scanText } from '../scripts/security-scan.mjs'

test('security scan distinguishes a secret value from a documented variable name or server-side read', () => {
  const assignment = (name, value) => [name, value].join('=')
  assert.deepEqual(scanText('README.md', assignment('SUPABASE_SERVICE_ROLE_KEY', '<set-in-hosting-secret-store>')), [])
  assert.deepEqual(scanText('lib/server.js', "const key = process.env.SUPABASE_SERVICE_ROLE_KEY"), [])
  assert.deepEqual(scanText('README.md', assignment('STRIPE_SECRET_KEY', '<set-in-hosting-secret-store>')), [])
  assert.deepEqual(scanText('README.md', assignment('STRIPE_WEBHOOK_SECRET', '<set-in-hosting-secret-store>')), [])

  assert.deepEqual(scanText('.env', assignment('SUPABASE_SERVICE_ROLE_KEY', 'eyJ-real-secret')), [
    { line: 1, label: 'Supabase service role key' },
  ])
  assert.deepEqual(scanText('.env', assignment('NEXT_PUBLIC_SERVICE_ROLE_KEY', 'not-safe')), [
    { line: 1, label: 'Secret env exposed publicly' },
  ])
})
