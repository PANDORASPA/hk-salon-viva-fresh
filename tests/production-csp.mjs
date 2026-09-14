import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { before, after, test } from 'node:test'
import { chromium } from '@playwright/test'

// Deliberately separate from credential-backed E2E and the unit glob.
// Run after npm run build. Never provisions accounts or contacts providers.
const root = fileURLToPath(new URL('../', import.meta.url))
let child, origin, browser
before(async () => {
  const socket = createServer()
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  origin = 'http://127.0.0.1:' + port
  const env = { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }
  // Empty values also prevent Next from loading credentials out of local env files.
  for (const key of new Set([...Object.keys(env), 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'])) {
    if (/SUPABASE|STRIPE|RESEND|WHATSAPP|E2E_|NOTIFY_|UPSTASH/i.test(key)) env[key] = ''
  }
  child = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.resume(); child.stderr.resume()
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error('Production app exited before loopback became ready')
    try { const response = await fetch(origin + '/signin'); if (response.status === 200) return } catch {}
    await delay(500)
  }
  throw new Error('Production app did not become ready on loopback')
})
after(async () => {
  await browser?.close()
  if (child?.exitCode === null) {
    const closed = once(child, 'close')
    child.kill()
    await closed
  }
})

function nonceFrom(response) {
  const policy = response.headers.get('content-security-policy')
  assert.ok(policy, 'document must have a CSP')
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/)
  const nonce = /'nonce-([A-Za-z0-9+/=]+)'/.exec(policy)?.[1]
  assert.ok(nonce, 'production document must have a nonce')
  assert.ok(Buffer.from(nonce, 'base64').length >= 16)
  return nonce
}
function assertScripts(html, nonce) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  assert.ok(scripts.length > 0, 'Next bootstrap must be present')
  assert.ok(scripts.some(([, attributes]) => !/\bsrc=/.test(attributes)), 'inline flight/bootstrap must be present')
  for (const [, attributes] of scripts) assert.equal(/\bnonce="([^"]+)"/.exec(attributes)?.[1], nonce, 'every script must match the response nonce')
}

test('built /signin serves fresh non-cacheable nonce HTML with a safe POST form', async () => {
  const response = await fetch(origin + '/signin')
  assert.equal(response.status, 200)
  const nonce = nonceFrom(response), html = await response.text()
  assertScripts(html, nonce)
  assert.match(response.headers.get('cache-control'), /no-store/)
  const form = /<form\b[^>]*class="[^"]*auth-form[^"]*"[^>]*>/.exec(html)?.[0]
  assert.ok(form)
  assert.match(form, /\bmethod="post"/i)
  assert.match(form, /\baction="\/api\/auth\/unavailable"/)
  assert.notEqual(nonceFrom(await fetch(origin + '/signin')), nonce)
  assert.doesNotMatch(html, /\sstyle="/)
})

test('built auth, package and error documents use nonce HTML too', async () => {
  for (const [path, status] of [['/signup', 200], ['/admin/login', 200], ['/about', 200], ['/gallery', 200], ['/packages', 200], ['/unavailable-page', 404], ['/', 500]]) {
    const response = await fetch(origin + path)
    // Home requires the deliberately absent Supabase configuration. Its safe
    // error document must also receive working CSP; this is not hosted proof.
    assert.equal(response.status, status, path)
    const nonce = nonceFrom(response), html = await response.text()
    assertScripts(html, nonce)
    for (const [, attributes] of html.matchAll(/<style\b([^>]*)>/g)) assert.equal(/\bnonce="([^"]+)"/.exec(attributes)?.[1], nonce)
    assert.doesNotMatch(html, /\sstyle="/, path)
  }
})

test('built fallback is no-store, refuses POST without echoing its body and does not accept GET', async () => {
  const response = await fetch(origin + '/api/auth/unavailable', { method: 'POST', body: 'nonsecret-probe-do-not-echo' })
  assert.equal(response.status, 503)
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.doesNotMatch(await response.text(), /nonsecret-probe-do-not-echo/)
  assert.equal((await fetch(origin + '/api/auth/unavailable')).status, 405)
})

test('built static assets stay cacheable and API denial does not receive document nonces', async () => {
  const html = await (await fetch(origin + '/signin')).text()
  const asset = /<script[^>]*\bsrc="([^"]+)"/.exec(html)?.[1]
  assert.ok(asset)
  const script = await fetch(origin + asset)
  assert.equal(script.status, 200)
  assert.match(script.headers.get('cache-control'), /immutable/)
  assert.equal(script.headers.get('content-security-policy'), null)
  const icon = await fetch(origin + '/icon.svg')
  assert.equal(icon.status, 200)
  assert.equal(icon.headers.get('content-security-policy'), null)
  const denied = await fetch(origin + '/api/appointments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.ok(denied.status >= 400)
  assert.doesNotMatch(denied.headers.get('content-security-policy') || '', /nonce-/)
})

test('Chromium hydrates sign-in under enforced CSP and rejects a native injected script', async t => {
  const executablePath = [
    chromium.executablePath(),
    process.env.LOCALAPPDATA && process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    process.env.PROGRAMFILES && process.env.PROGRAMFILES + '/Google/Chrome/Application/chrome.exe',
  ].find(path => path && existsSync(path))
  if (!executablePath) { t.skip('No installed Chromium; HTML-level integration still runs. No browser download attempted.'); return }
  browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ serviceWorkers: 'block' })
  // External fonts/images/providers are never contacted by this local proof.
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  await context.addInitScript(() => {
    window.cspViolations = []
    document.addEventListener('securitypolicyviolation', event => window.cspViolations.push(event.effectiveDirective))
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin + '/signin', { waitUntil: 'networkidle' })
  assert.equal(await page.locator('form.auth-form').evaluate(form => form.method), 'post')
  assert.equal(await page.locator('h1').evaluate(node => getComputedStyle(node).fontSize), '32px')
  assert.deepEqual(await page.evaluate(() => window.cspViolations), [])
  // An empty synthetic submit (no credentials) must be intercepted by hydrated React.
  assert.equal(await page.locator('form.auth-form').evaluate(form => {
    const event = new Event('submit', { bubbles: true, cancelable: true })
    form.dispatchEvent(event)
    return event.defaultPrevented
  }), true)
  await page.locator('form.auth-form').getByRole('alert').waitFor()
  assert.deepEqual(errors, [])
  assert.equal(page.url(), origin + '/signin')
  await page.goto(origin + '/about', { waitUntil: 'networkidle' })
  await page.locator('nav a[href="/packages"]').click()
  await page.waitForURL(origin + '/packages')
  assert.deepEqual(await page.evaluate(() => window.cspViolations), [], 'soft navigation must retain the active document nonce for styles')
  await page.route(origin + '/signin?csp-negative=1', async route => {
    const response = await route.fetch()
    const body = (await response.text()).replace('</head>', '<script>window.cspAttackRan = true</script></head>')
    await route.fulfill({ response, body })
  })
  // Inject in the network HTML, not a DevTools evaluation (which has elevated
  // debugging privileges). The real HTML parser must enforce this negative control.
  await page.goto(origin + '/signin?csp-negative=1', { waitUntil: 'networkidle' })
  assert.equal(await page.evaluate(() => window.cspAttackRan), undefined)
  await page.waitForFunction(() => window.cspViolations.includes('script-src-elem'))
  await context.close()
})

test('without JavaScript native sign-in posts only to the refusal endpoint, never a credential URL', async t => {
  if (!browser) { t.skip('No installed Chromium; no download attempted.'); return }
  const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' })
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  const page = await context.newPage()
  await page.goto(origin + '/signin')
  // Invented nonsecret fixtures only, submitted to a local endpoint which
  // never reads the body. No real credentials or provider session are used.
  await page.getByLabel('Email', { exact: true }).fill('fixture@example.test')
  await page.getByLabel('Password', { exact: true }).fill('nonsecret-fixture')
  const sent = page.waitForRequest(request => new URL(request.url()).pathname === '/api/auth/unavailable')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  const request = await sent
  assert.equal(request.method(), 'POST')
  assert.equal(request.url(), origin + '/api/auth/unavailable')
  await page.getByRole('heading', { name: '登入未完成' }).waitFor()
  assert.equal(page.url(), origin + '/api/auth/unavailable')
  assert.doesNotMatch(await page.content(), /fixture@example.test|nonsecret-fixture/)
  await context.close()
})
