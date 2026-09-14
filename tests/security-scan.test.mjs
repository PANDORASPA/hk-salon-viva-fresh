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
    `let ${key}: string = 'typed-literal'; ${key}='fifth-literal'`,
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

test('security scan handles trivia-separated, block, comma, and chained-shell assignments while skipping dynamic values', () => {
  const key = 'SUPABASE_SERVICE_ROLE_KEY'
  const stripe = 'STRIPE_SECRET_KEY'
  const webhook = 'STRIPE_WEBHOOK_SECRET'
  const publicKey = 'NEXT_PUBLIC_SERVICE_ROLE_KEY'
  const source = [
    'if (enabled) {',
    `  let ${key} =`,
    '',
    '  // a blank/comment-separated literal is still an assignment',
    "  'block-literal'",
    '}',
    `const count = 1, ${stripe} = 'comma-literal', ${webhook} = 'second-comma-literal'`,
    `const settings = { ${publicKey}:`,
    '  /* comment between the colon and value */',
    "  'object-literal' }",
    `set ${key}=shell-one && export ${stripe}=shell-two ${webhook}=shell-three`,
    `const processRead = process.env.${key}`,
    `const ${key} = process.env.INTERNAL_SERVICE_KEY`,
    `const ${stripe} = readSecret()`,
    `const ${webhook} = \`dynamic-${'${'}process.env.INTERNAL_SECRET}\``,
    `const envObject = { ${key}: process.env.INTERNAL_SERVICE_KEY }`,
    `${publicKey}=<documented-placeholder>`,
  ].join('\n')

  assert.deepEqual(scanText('fixture.ts', source), [
    { line: 2, label: 'Supabase service role key' },
    { line: 7, label: 'Stripe secret key' },
    { line: 7, label: 'Stripe webhook secret' },
    { line: 8, label: 'Secret env exposed publicly' },
    { line: 11, label: 'Supabase service role key' },
    { line: 11, label: 'Stripe secret key' },
    { line: 11, label: 'Stripe webhook secret' },
  ])
})

test('security scan does not consume the next dotenv field after an empty value', () => {
  const source = [
    'STRIPE_SECRET_KEY=',
    'STRIPE_WEBHOOK_SECRET=',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=sb_publishable_example',
  ].join('\n')

  assert.deepEqual(scanText('.env.example', source), [])
})

test('security scan uses language-aware matchers for quoted object keys, multiline assignments, and shell syntax', () => {
  const key = 'SUPABASE_SERVICE_ROLE_KEY'
  const stripe = 'STRIPE_SECRET_KEY'
  const webhook = 'STRIPE_WEBHOOK_SECRET'

  const json = `{
  "${key}": "json-literal",
  "${stripe}": "second-json-literal"
}`
  assert.deepEqual(scanText('fixture.json', json), [
    { line: 2, label: 'Supabase service role key' },
    { line: 3, label: 'Stripe secret key' },
  ])

  const javascript = [
    `${key} =`,
    '  // a non-declaration assignment can span trivia too',
    "  'assignment-literal'",
    `const config = { '${webhook}': 'object-literal' }`,
  ].join('\n')
  assert.deepEqual(scanText('fixture.js', javascript), [
    { line: 1, label: 'Supabase service role key' },
    { line: 4, label: 'Stripe webhook secret' },
  ])

  const powershell = [
    '$env:stripe_secret_key =',
    '  # comment before the literal',
    "  'powershell-literal'",
    '$env:STRIPE_WEBHOOK_SECRET = "$env:OTHER_SECRET"',
  ].join('\n')
  assert.deepEqual(scanText('fixture.ps1', powershell), [
    { line: 1, label: 'Stripe secret key' },
  ])

  const shell = [
    'CALLBACK=https://example.test/path; export STRIPE_SECRET_KEY=shell-literal STRIPE_WEBHOOK_SECRET="${WEBHOOK_FROM_ENV}"',
    'export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"',
  ].join('\n')
  assert.deepEqual(scanText('fixture.sh', shell), [
    { line: 1, label: 'Stripe secret key' },
  ])
})
