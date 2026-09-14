import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isCustomerPackageUsable,
  listUsablePackagesForCustomer,
  applyRedemption,
  reverseRedemption,
} from '../lib/booking/package-usage.js'

const future = new Date(Date.now() + 30 * 86_400_000).toISOString()
const past = new Date(Date.now() - 86_400_000).toISOString()

test('isCustomerPackageUsable returns true only for active, non-expired, non-empty packages', () => {
  assert.equal(
    isCustomerPackageUsable({ is_active: true, expires_at: future, sessions_remaining: 5 }),
    true,
  )
  assert.equal(
    isCustomerPackageUsable({ is_active: false, expires_at: future, sessions_remaining: 5 }),
    false,
  )
  assert.equal(
    isCustomerPackageUsable({ is_active: true, expires_at: past, sessions_remaining: 5 }),
    false,
  )
  assert.equal(
    isCustomerPackageUsable({ is_active: true, expires_at: future, sessions_remaining: 0 }),
    false,
  )
  assert.equal(isCustomerPackageUsable(null), false)
  assert.equal(isCustomerPackageUsable(undefined), false)
})

test('listUsablePackagesForCustomer filters out unusable packages', () => {
  const packages = [
    { id: 1, is_active: true, expires_at: future, sessions_remaining: 5 },
    { id: 2, is_active: false, expires_at: future, sessions_remaining: 5 },
    { id: 3, is_active: true, expires_at: past, sessions_remaining: 5 },
    { id: 4, is_active: true, expires_at: future, sessions_remaining: 0 },
    { id: 5, is_active: true, expires_at: future, sessions_remaining: 1 },
  ]
  const usable = listUsablePackagesForCustomer(packages)
  assert.deepEqual(
    usable.map((p) => p.id).sort(),
    [1, 5],
  )
})

for (const [name, command] of [['applyRedemption', applyRedemption], ['reverseRedemption', reverseRedemption]]) {
  test(name + ' retires the unsafe standalone balance mutation without any database call', async () => {
    const db = { rpc() { throw new Error('Retired command must not call RPC') }, from() { throw new Error('Retired command must not mutate a table') } }
    assert.deepEqual(await command(db, { customerPackageId: 7, appointmentId: 99 }), { ok: false, reason: 'operation_retired' })
  })
}

test('applyRedemption refuses an unusable package without writing', async () => {
  const db = {
    rpc: async () => ({ data: null, error: { message: 'function not found' } }),
    from: () => {
      throw new Error('should not be called')
    },
  }
  // The path the function takes when the lookup itself fails
  const result = await applyRedemption(db, { customerPackageId: undefined, appointmentId: 99 })
  assert.equal(result.ok, false)
})
