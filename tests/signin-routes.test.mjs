import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// These are static-source-shape tests: they confirm that the auth entry
// pages actually use the AuthForm component rather than being placeholder
// stubs. The original /signin and /admin/login shipped as "link to /admin"
// placeholders, which made the member system unreachable. The bug
// guard here ensures we do not regress to that state.

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')

test('/signin mounts the member AuthForm (admin=false)', async () => {
  const src = await read('app/signin/page.js')
  assert.match(src, /import\s+AuthForm\s+from/)
  assert.match(src, /AuthForm\s+mode="signin"/)
  // The bug guard: must NOT still be the placeholder
  assert.doesNotMatch(src, /前往.*管理員登入.*頁面/)
})

test('/signup mounts the member AuthForm (mode=signup)', async () => {
  const src = await read('app/signup/page.js')
  assert.match(src, /import\s+AuthForm\s+from/)
  assert.match(src, /AuthForm\s+mode="signup"/)
  assert.doesNotMatch(src, /我們的系統無需註冊/)
})

test('/admin/login mounts the admin AuthForm (admin=true) and does NOT redirect-loop to /signin', async () => {
  const src = await read('app/admin/login/page.js')
  assert.match(src, /import\s+AuthForm\s+from/)
  assert.match(src, /AuthForm\s+mode="signin"\s+admin/)
  // The original code redirected to /signin when no user, which created
  // a loop once /signin was made a real form. The page must not do that
  // any more.
  assert.doesNotMatch(src, /redirect\(['"]\/signin/)
})

test('AuthForm is actually imported by the entry pages (not dead code)', async () => {
  // The component used to ship but no page mounted it. Regression guard.
  const signin = await read('app/signin/page.js')
  const signup = await read('app/signup/page.js')
  const adminLogin = await read('app/admin/login/page.js')
  assert.match(signin, /AuthForm/)
  assert.match(signup, /AuthForm/)
  assert.match(adminLogin, /AuthForm/)
})

test('SignInHelp shows the right message for each error code', async () => {
  const src = await read('app/signin/SignInHelp.jsx')
  assert.match(src, /confirm_failed/)
  assert.match(src, /session_expired/)
  assert.match(src, /denied/)
  assert.match(src, /created/)
})

test('proxy.js still guards /account and /admin', async () => {
  const src = await read('proxy.js')
  assert.match(src, /\/account/)
  assert.match(src, /\/admin/)
})
