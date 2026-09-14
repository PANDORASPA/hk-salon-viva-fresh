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
  const javascript = [
    `const ${key} =`,
    "  'first-literal'",
    `const ${key} = 'second-literal';`,
    `let ${key}: string = 'typed-literal'; ${key}='fifth-literal'`,
    `{ ${publicKey}: 'public-literal' }`,
  ].join('\n')

  assert.deepEqual(scanText('fixture.ts', javascript), [
    { line: 1, label: 'Supabase service role key' },
    { line: 3, label: 'Supabase service role key' },
    { line: 4, label: 'Supabase service role key' },
    { line: 4, label: 'Supabase service role key' },
    { line: 5, label: 'Secret env exposed publicly' },
  ])

  assert.deepEqual(scanText('fixture.sh', `export ${stripe}=third-literal ${webhook}=fourth-literal`), [
    { line: 1, label: 'Stripe secret key' },
    { line: 1, label: 'Stripe webhook secret' },
  ])
  assert.deepEqual(scanText('fixture.ps1', `$env:${webhook} = "fifth-literal"`), [
    { line: 1, label: 'Stripe webhook secret' },
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
  ])
  assert.deepEqual(scanText('fixture.sh', `set ${key}=shell-one && export ${stripe}=shell-two ${webhook}=shell-three`), [
    { line: 1, label: 'Supabase service role key' },
    { line: 1, label: 'Stripe secret key' },
    { line: 1, label: 'Stripe webhook secret' },
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

test('security scan handles exhaustive bare, expression, dotenv, and PowerShell assignment cases', () => {
  const key = 'SUPABASE_SERVICE_ROLE_KEY'
  const stripe = 'STRIPE_SECRET_KEY'
  const webhook = 'STRIPE_WEBHOOK_SECRET'
  const cases = [
    {
      name: 'three bare shell assignments in any token position',
      file: 'fixture.sh',
      source: `${key}=bare-one ${stripe}=bare-two ${webhook}=bare-three`,
      expected: [
        { line: 1, label: 'Supabase service role key' },
        { line: 1, label: 'Stripe secret key' },
        { line: 1, label: 'Stripe webhook secret' },
      ],
    },
    {
      name: 'a callback URL stays a shell value before a later secret',
      file: 'fixture.sh',
      source: `CALLBACK=https://example.test/hook ${stripe}=after-url`,
      expected: [{ line: 1, label: 'Stripe secret key' }],
    },
    {
      name: 'dotenv accepts an optional export prefix',
      file: '.env.example',
      source: `export ${stripe}=dotenv-literal`,
      expected: [{ line: 1, label: 'Stripe secret key' }],
    },
    {
      name: 'a JavaScript literal concatenated with an environment read is dynamic',
      file: 'fixture.ts',
      source: `const ${key} = 'literal' + process.env.INTERNAL_SECRET`,
      expected: [],
    },
    {
      name: 'PowerShell hides block comments and skips commands while retaining static credentials',
      file: 'fixture.ps1',
      source: [
        `<# $env:${stripe} = 'comment-only' #>`,
        `$env:${stripe} = Get-Secret`,
        `$env:${webhook} = powershell_static_credential`,
      ].join('\n'),
      expected: [{ line: 3, label: 'Stripe webhook secret' }],
    },
  ]

  for (const { name, file, source, expected } of cases) {
    assert.deepEqual(scanText(file, source), expected, name)
  }
})

test('security scan classifies JavaScript expression tails and module-qualified PowerShell commands', () => {
  const key = 'SUPABASE_SERVICE_ROLE_KEY'
  const stripe = 'STRIPE_SECRET_KEY'
  const cases = [
    { category: 'function default', file: 'fixture.ts', source: `function configure(${key} = 'default-literal') {}`, expected: [{ line: 1, label: 'Supabase service role key' }] },
    { category: 'call argument', file: 'fixture.ts', source: `configure(${key} = 'argument-literal')`, expected: [{ line: 1, label: 'Supabase service role key' }] },
    { category: 'array assignment', file: 'fixture.ts', source: `[${key} = 'array-literal']`, expected: [{ line: 1, label: 'Supabase service role key' }] },
    { category: 'TypeScript as assertion', file: 'fixture.ts', source: `const ${key} = 'asserted-literal' as const`, expected: [{ line: 1, label: 'Supabase service role key' }] },
    { category: 'TypeScript satisfies assertion', file: 'fixture.ts', source: `const ${key} = 'satisfied-literal' satisfies string`, expected: [{ line: 1, label: 'Supabase service role key' }] },
    { category: 'JavaScript export is not shell syntax', file: 'fixture.ts', source: `export ${stripe}=bare-shell-looking-value`, expected: [] },
    { category: 'concatenation', file: 'fixture.ts', source: `const ${key} = 'literal' + process.env.INTERNAL_SECRET`, expected: [] },
    { category: 'template interpolation', file: 'fixture.ts', source: `const ${key} = \`literal-${'${'}process.env.INTERNAL_SECRET}\``, expected: [] },
    { category: 'property access', file: 'fixture.ts', source: `const ${key} = 'literal'.trim()`, expected: [] },
    { category: 'index access', file: 'fixture.ts', source: `const ${key} = 'literal'[0]`, expected: [] },
    { category: 'call access', file: 'fixture.ts', source: `const ${key} = 'literal'()`, expected: [] },
    { category: 'independent environment statement across newline', file: 'fixture.ts', source: `const ${key} = 'literal'\nprocess.env.INTERNAL_SECRET`, expected: [{ line: 1, label: 'Supabase service role key' }] },
    { category: 'independent function statement across newline', file: 'fixture.ts', source: `const ${key} = 'literal'\ngetSecret()`, expected: [{ line: 1, label: 'Supabase service role key' }] },
    { category: 'module-qualified Get-Secret command', file: 'fixture.ps1', source: `$env:${stripe} = Microsoft.PowerShell.SecretManagement\\Get-Secret`, expected: [] },
  ]

  for (const { category, file, source, expected } of cases) {
    assert.deepEqual(scanText(file, source), expected, category)
  }
})
