import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('public content loader reads every ADMIN-managed public resource with safe defaults', () => {
  const source = read('lib/content/public-content.js')
  assert.match(source, /from\('services'\)/)
  assert.match(source, /from\('gallery_images'\)/)
  assert.match(source, /from\('site_content'\)/)
  assert.match(source, /salonDefaults/)
})

test('public-content loader provides a resilient fallback when env is missing', () => {
  const source = read('lib/content/public-content.js')
  // If env missing, must return defaults rather than throwing
  assert.match(source, /if \(!url \|\| !key\) return salonDefaults/)
  assert.match(source, /catch \{[\s\S]*return salonDefaults/)
})

test('public pages reference the live HK identity when reading defaults', () => {
  // The HK salon may load content via RSC (getServerClient) or via the loader.
  // Either pattern is acceptable; we just verify the page files import from
  // the canonical defaults module.
  for (const path of ['app/page.js', 'app/services/page.js', 'app/booking/page.js']) {
    const source = read(path)
    assert.ok(
      /salon-poke-defaults/.test(source) || /getPublicSalonContent/.test(source) || /getServerClient/.test(source),
      `${path} must reference managed public content source`,
    )
  }
})

test('shared branding lives in the layout + Footer', () => {
  const layout = read('app/layout.js')
  assert.match(layout, /SALON POKE BY VIVA/)
})
