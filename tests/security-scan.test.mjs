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

test('security scan finds each literal assignment across JavaScript, shell, PowerShell, and object syntax', () => {
  const key = 'SUPABASE_SERVICE_ROLE_KEY'
  const stripe = 'STRIPE_SECRET_KEY'
  const webhook = 'STRIPE_WEBHOOK_SECRET'
  const publicKey = 'NEXT_PUBLIC_SERVICE_ROLE_KEY'
  const source = [
    `const ${key} =`,
    "  'first-literal'",
    `const ${key} = 'second-literal'; export ${stripe}=third-literal ${webhook}=fourth-literal; $env:${webhook} = \"fifth-literal\"`,
    `let ${key}: string = 'typed-literal'; ${key}=fifth-literal`,
    `{ ${publicKey}: 'public-literal' }`,
  ].join('\n')

  assert.deepEqual(scanText('fixture.ts', source), [
    { line: 1, label: 'Supabase service role key' },
    { line: 3, label: 'Supabase service role key' },
    { line: 3, label: 'Stripe secret key' },
    { line: 3, label: 'Stripe webhook secret' },
    { line: 3, label: 'Stripe webhook secret' },
    { line: 4, label: 'Supabase service role key' },
    { line: 4, label: 'Supabase service role key' },
    { line: 5, label: 'Secret env exposed publicly' },
  ])
})

test('security scan ignores env reads, prose, comments, and placeholders in every supported syntax', () => {
  const key = 'SUPABASE_SERVICE_ROLE_KEY'
  const stripe = 'STRIPE_SECRET_KEY'
  const publicKey = 'NEXT_PUBLIC_SERVICE_ROLE_KEY'
  const source = [
    `const serviceKey = process.env.${key}`,
    `# ${key}=<set-in-secret-store>`,
    `${key}=<set-in-secret-store>`,
    `$env:${key} = '<set-in-secret-store>'`,
    `const ${stripe} =`,
    "  '<set-in-secret-store>'",
    `{ ${key}: '<set-in-secret-store>' }`,
    `Documentation: ${publicKey} is forbidden in public configuration.`,
  ].join('\n')

  assert.deepEqual(scanText('README.md', source), [])
})
