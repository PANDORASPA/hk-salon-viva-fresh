import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Script } from 'node:vm'
import test from 'node:test'
import { NextRequest, NextResponse } from './helpers/next-response.mjs'
import { scanText } from '../scripts/security-scan.mjs'

const require = createRequire(import.meta.url)
const root = new URL('../', import.meta.url)
const policyModule = () => import('../lib/security/request-policy.js')
const request = (url = 'https://salon.example/signin') => new NextRequest(url, { headers: { 'x-nonce': 'attacker-value', 'content-security-policy': "script-src 'unsafe-inline'" } })

test('production nonce is fresh, strong, authoritative and shared by the upstream and response CSP', async () => {
  const { createCspProxy } = await policyModule()
  const proxy = createCspProxy({ NextResponse, env: { NODE_ENV: 'production' } })
  const first = await proxy(request()), second = await proxy(request())
  const nonce = first.headers.get('x-middleware-request-x-nonce')
  assert.match(nonce, /^[A-Za-z0-9+/]{32}$/)
  assert.notEqual(nonce, second.headers.get('x-middleware-request-x-nonce'))
  const csp = first.headers.get('content-security-policy')
  assert.equal(csp, first.headers.get('x-middleware-request-content-security-policy'))
  assert.ok(csp.includes("'nonce-" + nonce + "'"))
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|attacker-value/)
  for (const directive of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", 'upgrade-insecure-requests', "script-src-attr 'none'", "style-src-attr 'none'"]) assert.ok(csp.includes(directive), directive)
  assert.match(first.headers.get('cache-control'), /private.*no-store/)
})

test('development supports debugging and local HTTP is not forcibly upgraded, even in a production smoke', async () => {
  const { createCspProxy } = await policyModule()
  const dev = await createCspProxy({ NextResponse, env: { NODE_ENV: 'development' } })(request('http://localhost:3000/signin'))
  assert.match(dev.headers.get('content-security-policy'), /unsafe-eval/)
  assert.doesNotMatch(dev.headers.get('content-security-policy'), /upgrade-insecure-requests/)
  const local = await createCspProxy({ NextResponse, env: { NODE_ENV: 'production' } })(request('http://127.0.0.1:3100/signin'))
  assert.doesNotMatch(local.headers.get('content-security-policy'), /unsafe-inline|unsafe-eval|upgrade-insecure-requests/)
})

test('session cookie refresh preserves the nonce in both rendering headers and auth redirects', async () => {
  const { createCspProxy } = await policyModule()
  for (const [pathname, user, redirect] of [['/signin', null, false], ['/account', null, true], ['/admin', { id: 'user' }, true]]) {
    const proxy = createCspProxy({
      NextResponse, env: { NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'nonsecret-fixture' },
      createServerClient: (_url, _key, { cookies }) => ({
        auth: { getUser: async () => { cookies.setAll([{ name: 'session', value: 'refreshed', options: { httpOnly: true } }]); return { data: { user } } } },
        from: () => ({ select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: null }) }),
      }),
    })
    const response = await proxy(request('https://salon.example' + pathname))
    assert.match(response.headers.get('content-security-policy'), /nonce-/)
    assert.match(response.headers.get('cache-control'), /no-store/)
    assert.equal(response.cookies.get('session')?.value, 'refreshed')
    assert.equal(response.status, redirect ? 307 : 200)
    if (!redirect) {
      assert.match(response.headers.get('x-middleware-request-cookie'), /session=refreshed/)
      assert.equal(response.headers.get('x-middleware-request-content-security-policy'), response.headers.get('content-security-policy'))
    }
  }
})

test('proxy covers document/auth/RSC paths while leaving API, image, static and public assets alone', async () => {
  // The installed 16.3 runtime still exports the legacy name.
  const { unstable_doesMiddlewareMatch: unstable_doesProxyMatch } = require('next/experimental/testing/server.js')
  const { parse } = require('next/dist/compiled/babel/parser')
  const source = await readFile(new URL('proxy.js', root), 'utf8')
  const ast = parse(source, { sourceType: 'module' })
  const config = ast.program.body.find(node => node.type === 'ExportNamedDeclaration' && node.declaration?.declarations?.[0]?.id?.name === 'config').declaration.declarations[0].init
  const matcher = config.properties.find(node => node.key.name === 'matcher').value.elements.map(node => node.value)
  for (const url of ['/signin', '/signup', '/account', '/admin/login', '/booking', '/gallery', '/not-existing', '/signin?_rsc=probe']) assert.equal(unstable_doesProxyMatch({ config: { matcher }, url }), true, url)
  for (const url of ['/api/appointments', '/_next/static/chunk.js', '/_next/image?url=x', '/favicon.ico', '/icon.svg', '/og-image.svg', '/gallery/test.png', '/assets/test.css', '/robots.txt', '/sitemap.xml']) assert.equal(unstable_doesProxyMatch({ config: { matcher }, url }), false, url)
  const configured = await require('../next.config.js').headers()
  assert.ok(configured.every(rule => rule.headers.every(header => header.key.toLowerCase() !== 'content-security-policy')))
})

test('non-hydrated auth endpoint refuses without reading, echoing or logging the submitted body', async () => {
  const { POST } = await import('../app/api/auth/unavailable/route.js')
  const response = await POST(new Proxy({}, { get() { throw new Error('must not inspect credentials') } }))
  assert.equal(response.status, 503)
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/)
  const body = await response.text()
  assert.match(body, /JavaScript|重新載入/)
  assert.doesNotMatch(body, /<script|password=|email=/)
})

test('all credential forms have an explicit same-origin POST fallback', async () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const { transformSync } = require('next/dist/compiled/babel/core')
  const dict = await import('../lib/i18n/dict.js')
  for (const file of ['app/components/AuthForm.jsx', 'app/reset/ResetForm.jsx', 'app/forgot/ForgotForm.jsx']) {
    const source = await readFile(new URL(file, root), 'utf8')
    const { code } = transformSync(source, {
      filename: file, babelrc: false, configFile: false,
      presets: [[require('next/dist/compiled/babel/preset-react'), { runtime: 'automatic' }]],
      plugins: [require('next/dist/compiled/babel/plugin-transform-modules-commonjs')],
    })
    const module = { exports: {} }
    new Script(code).runInNewContext({
      module, exports: module.exports,
      require: id => {
        if (id === 'next/navigation') return { useRouter: () => ({}), useSearchParams: () => new URLSearchParams() }
        if (id === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children)
        if (id.includes('supabase/browser')) return { getBrowserClient: () => { throw new Error('SSR must not contact Auth') } }
        if (id.includes('i18n/dict')) return dict
        return require(id)
      },
    })
    const html = renderToStaticMarkup(React.createElement(module.exports.default))
    const form = /<form\b[^>]*>/.exec(html)?.[0]
    assert.match(form, /method="post"/)
    assert.match(form, /action="\/api\/auth\/unavailable"/)
  }
})

test('application markup does not depend on forbidden inline style attributes', async () => {
  const { parse } = require('next/dist/compiled/babel/parser')
  const failures = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
      if (entry.isDirectory()) { await visit(url); continue }
      if (!/\.(?:js|jsx)$/.test(entry.name)) continue
      const ast = parse(await readFile(url, 'utf8'), { sourceType: 'module', plugins: ['jsx'] })
      function walk(node) {
        if (!node || typeof node !== 'object') return
        if (node.type === 'JSXAttribute' && node.name.name === 'style') failures.push(url.pathname + ':' + node.loc.start.line)
        for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value)
      }
      walk(ast)
    }
  }
  await visit(new URL('app/', root))
  assert.deepEqual(failures, [])
})

test('package accent CSS keeps configured colours but cannot inject selectors, declarations or HTML', async () => {
  const { packageAccentCss } = await import('../lib/content/package-accent.js')
  assert.equal(packageAccentCss([{ colour_hex: '#123456' }, { colour_hex: '</style><script>bad()</script>' }]), '.package-accent-0{border-left-color:#123456}.package-accent-1{border-left-color:#a98152}')
})

test('scanner respects newline prefix increment/decrement ASI without changing dynamic expression tails', () => {
  const key = 'SUPABASE_SERVICE_ROLE_KEY'
  const prefix = 'const ' + key + ' = "sensitive_static_fixture"'
  for (const tail of ['\n++counter', '\n--counter', '\r\n++counter', ' /* line\n comment */ --counter', ' // comment\n++counter']) {
    assert.deepEqual(scanText('probe.js', prefix + tail), [{ line: 1, label: 'Supabase service role key' }], tail)
  }
  for (const tail of [' + ++counter', ' - --counter', '\n+ ++counter', '\n- --counter', '\n+process.env.SUFFIX', '\n.trim()', '\n[0]', '\n("arg")']) assert.deepEqual(scanText('probe.js', prefix + tail), [], tail)
})
