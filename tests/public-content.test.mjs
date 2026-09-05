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

test('public pages consume ADMIN-managed content', () => {
  for (const path of ['app/page.js', 'app/services/page.js', 'app/gallery/page.js']) {
    assert.match(read(path), /getPublicSalonContent/, `${path} must load managed public content`)
  }
})

test('shared branding and contact components consume ADMIN-managed content', () => {
  assert.match(read('app/layout.js'), /getPublicSalonContent/)
  assert.match(read('app/components/Navbar.js'), /salon/)
  assert.match(read('app/components/Footer.js'), /salon/)
})

test('ADMIN content mutations invalidate affected public pages', () => {
  for (const path of ['app/api/admin/services/route.js', 'app/api/admin/gallery/route.js', 'app/api/admin/site-content/route.js']) {
    assert.match(read(path), /revalidatePath/, `${path} must publish changes to the public site`)
  }
})

test('services and homepage copy can be edited, not only created', () => {
  const source = read('app/components/admin/SalonAdminModules.jsx')
  assert.match(source, /Save changes/)
  assert.match(source, /Hero description/)
  assert.match(source, /Booking message/)
})
