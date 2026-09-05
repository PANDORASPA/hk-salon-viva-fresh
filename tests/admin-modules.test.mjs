import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root),'utf8')
const modules = ['appointments','services','schedule','gallery','site-content','administrators']

test('admin shell contains exactly the six approved operating modules', async () => {
  const source = await read('app/admin/AdminShell.jsx')
  for (const name of modules) assert.match(source,new RegExp(name,'i'),name)
  assert.doesNotMatch(source,/inventory|tickets|stripe|coupons|orders|products/i)
})

test('every admin module has a protected route contract', async () => {
  for (const name of modules) {
    const source = await read(`app/api/admin/${name}/route.js`)
    assert.match(source,/adminContext\(/,name)
    assert.match(source,/guardMutationRequest\(/,name)
  }
})

test('administrator API delegates final-admin protection to the database and never uses metadata claims', async () => {
  const source = await read('app/api/admin/administrators/route.js')
  assert.match(source,/admin_users/)
  assert.match(source,/is_active/)
  assert.doesNotMatch(source,/user_metadata|raw_user_meta_data|member_profiles/)
})
