import assert from 'node:assert/strict'
import test from 'node:test'
import authModule from '../lib/auth/admin.js'
const { resolveAdminState } = authModule

test('resolveAdminState rejects a missing session', async () => {
  assert.deepEqual(await resolveAdminState({ user: null, findAdmin: async () => ({ is_active: true }) }), { user: null, isAdmin: false })
})

test('resolveAdminState accepts only an active admin_users row', async () => {
  const user = { id: 'user-1', email: 'owner@example.com' }
  assert.equal((await resolveAdminState({ user, findAdmin: async () => ({ user_id: user.id, is_active: true }) })).isAdmin, true)
  assert.equal((await resolveAdminState({ user, findAdmin: async () => ({ user_id: user.id, is_active: false }) })).isAdmin, false)
  assert.equal((await resolveAdminState({ user, findAdmin: async () => null })).isAdmin, false)
})
