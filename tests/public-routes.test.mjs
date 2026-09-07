import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

const publicFiles = [
  'app/layout.js',
  'app/page.js',
  'app/services/page.js',
  'app/booking/page.js',
  'app/gallery/page.js',
  'app/about/page.js',
  'app/contact/page.js',
  'app/terms/page.js',
  'app/privacy/page.js',
  'app/location/page.js',
]

test('public HK salon pages contain no leftover rebrand wording (Pandora / VIVA Hair / Bristol)', async () => {
  for (const file of publicFiles) {
    const source = await read(file)
    assert.doesNotMatch(source, /PANDORA HEAD SPA/i, file)
    assert.doesNotMatch(source, /PALACE HAIR SPA/i, file)
    assert.doesNotMatch(source, /VIVA Hair/i, file)
    assert.doesNotMatch(source, /Bristol/i, file)
  }
})

test('public pages do not link to legacy HK/Pandora routes (tickets/products/articles/faq)', async () => {
  for (const file of publicFiles) {
    const source = await read(file)
    assert.doesNotMatch(source, /\/tickets|\/products|\/articles|\/faq/, file)
  }
})

test('home page surfaces the HK hair loss treatment brand and a WhatsApp contact action', async () => {
  const source = await read('app/page.js')
  assert.match(source, /SALON POKE/)
  assert.match(source, /爆毛術/)
  assert.match(source, /wa\.me/) // WhatsApp deep link
})

test('shared navigation exposes the live HK salon route set', async () => {
  const source = await read('app/components/Navbar.js').catch(() => '')
  // Navbar.js is optional; if not present, the layout's inline nav must include the routes
  const navSource = source || (await read('app/layout.js'))
  for (const route of ['/services', '/booking', '/gallery', '/about', '/contact']) {
    assert.match(navSource, new RegExp(route.replace('/', '\\/')), route)
  }
})
