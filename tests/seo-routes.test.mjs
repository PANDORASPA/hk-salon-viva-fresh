import assert from 'node:assert/strict'
import test from 'node:test'

// Use a stub env so we can import the route modules without touching
// the real process env (the route files reference process.env at
// module-load time).
process.env.NEXT_PUBLIC_SITE_URL = 'https://salonpokeviva.com'

const sitemapModule = await import('../app/sitemap.js')
const robotsModule = await import('../app/robots.js')

const sitemap = sitemapModule.default
const robots = robotsModule.default

test('sitemap exports a function', () => {
  assert.equal(typeof sitemap, 'function')
})

test('sitemap returns expected canonical pages', () => {
  const entries = sitemap()
  assert.ok(Array.isArray(entries))
  assert.ok(entries.length >= 6)
  const paths = entries.map((e) => new URL(e.url).pathname)
  for (const required of ['/', '/booking', '/services', '/about', '/contact']) {
    assert.ok(paths.includes(required), `expected ${required} in sitemap`)
  }
})

test('sitemap never exposes /admin or /api', () => {
  const entries = sitemap()
  for (const e of entries) {
    const pathname = new URL(e.url).pathname
    assert.ok(!pathname.startsWith('/admin'), `admin path leaked: ${pathname}`)
    assert.ok(!pathname.startsWith('/api'), `api path leaked: ${pathname}`)
    assert.ok(!pathname.startsWith('/account'), `account path leaked: ${pathname}`)
  }
})

test('sitemap entry shape', () => {
  const entries = sitemap()
  for (const e of entries) {
    assert.equal(typeof e.url, 'string')
    assert.ok(e.url.startsWith('https://salonpokeviva.com'))
    assert.ok(typeof e.lastModified === 'string' || e.lastModified instanceof Date)
    assert.ok(typeof e.changeFrequency === 'string')
    assert.equal(typeof e.priority, 'number')
    assert.ok(e.priority >= 0 && e.priority <= 1)
  }
})

test('robots disallows admin and api areas', () => {
  const out = robots()
  assert.ok(Array.isArray(out.rules))
  const rule = out.rules[0]
  assert.equal(rule.userAgent, '*')
  assert.equal(rule.allow, '/')
  const disallowed = rule.disallow
  assert.ok(disallowed.includes('/admin'))
  assert.ok(disallowed.some((p) => p.startsWith('/admin/')))
  assert.ok(disallowed.includes('/api'))
  assert.ok(disallowed.some((p) => p.startsWith('/api/')))
  assert.ok(disallowed.includes('/account'))
})

test('robots advertises the sitemap URL', () => {
  const out = robots()
  assert.equal(out.sitemap, 'https://salonpokeviva.com/sitemap.xml')
  assert.equal(out.host, 'https://salonpokeviva.com')
})
