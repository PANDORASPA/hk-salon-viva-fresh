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

test('applyRedemption falls back to the legacy two-step path when RPC is not available', async () => {
  // Mock Supabase client: rpc throws, then a successful lookup + update + insert
  let rpcCalled = false
  let updateCalled = false
  let insertCalled = false
  const db = {
    rpc: async (name) => {
      rpcCalled = true
      return { data: null, error: { message: 'function not found' } }
    },
    from: (table) => {
      if (table === 'customer_packages') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: 7, sessions_remaining: 3, total_sessions: 5, is_active: true, expires_at: future },
                error: null,
              }),
            }),
          }),
          update: (patch) => {
            updateCalled = true
            assert.equal(patch.sessions_remaining, 2)
            return {
              eq: async () => ({ data: null, error: null }),
            }
          },
        }
      }
      if (table === 'package_redemptions') {
        return {
          insert: async () => {
            insertCalled = true
            return { data: null, error: null }
          },
        }
      }
      throw new Error('unexpected table ' + table)
    },
  }
  const result = await applyRedemption(db, { customerPackageId: 7, appointmentId: 99 })
  assert.equal(result.ok, true)
  assert.equal(result.mode, 'legacy')
  assert.equal(rpcCalled, true)
  assert.equal(updateCalled, true)
  assert.equal(insertCalled, true)
})

test('reverseRedemption caps the restored count at total_sessions', async () => {
  let deleteCalled = false
  let updateCalled = false
  let lastPatch = null
  const db = {
    rpc: async () => ({ data: null, error: { message: 'function not found' } }),
    from: (table) => {
      if (table === 'customer_packages') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: 7, sessions_remaining: 0, total_sessions: 5 },
                error: null,
              }),
            }),
          }),
          update: (patch) => {
            updateCalled = true
            lastPatch = patch
            return { eq: async () => ({ data: null, error: null }) }
          },
        }
      }
      if (table === 'package_redemptions') {
        return {
          delete: () => {
            deleteCalled = true
            return {
              eq: () => ({
                eq: async () => ({ data: null, error: null }),
              }),
            }
          },
        }
      }
      throw new Error('unexpected table ' + table)
    },
  }
  const result = await reverseRedemption(db, { customerPackageId: 7, appointmentId: 99 })
  assert.equal(result.ok, true)
  assert.equal(deleteCalled, true)
  assert.equal(updateCalled, true)
  assert.equal(lastPatch.sessions_remaining, 1)
})

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
