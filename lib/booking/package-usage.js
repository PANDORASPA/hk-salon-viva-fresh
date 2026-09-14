/**
 * Read-only legacy package helpers.
 * Standalone redemption/refund writers are retired. Booking v2 commands own
 * balance, appointment and retained redemption changes in one SQL transaction.
 */
/**
 * Returns true if the customer package can still be redeemed right now.
 */
export function isCustomerPackageUsable(cp, { now = new Date() } = {}) {
  if (!cp) return false
  if (!cp.is_active) return false
  if (new Date(cp.expires_at).getTime() <= now.getTime()) return false
  if ((cp.sessions_remaining ?? 0) < 1) return false
  return true
}

/**
 * List usable package instances for a customer. Filtered client-side to
 * avoid extra round trips — the API path uses the same filter via `is_active`
 * + non-null `sessions_remaining`.
 */
export function listUsablePackagesForCustomer(packages = [], { now = new Date() } = {}) {
  return (packages || []).filter((cp) => isCustomerPackageUsable(cp, { now }))
}

/**
 * Validate + lock a customer package for redemption. Returns the package row
 * (or null) without mutating it. Caller is responsible for the actual decrement
 * in a transaction. We expose a `redeem` wrapper for convenience.
 */
export async function findRedeemableCustomerPackage(db, { customerPackageId, customerId }) {
  if (!customerPackageId) return { data: null, reason: 'no_id' }
  const { data, error } = await db
    .from('customer_packages')
    .select('id, customer_id, package_id, total_sessions, sessions_remaining, is_active, expires_at')
    .eq('id', customerPackageId)
    .maybeSingle()
  if (error) return { data: null, reason: 'lookup_failed', error }
  if (!data) return { data: null, reason: 'not_found' }
  if (customerId && String(data.customer_id) !== String(customerId)) {
    return { data: null, reason: 'customer_mismatch' }
  }
  if (!isCustomerPackageUsable(data)) {
    return { data: null, reason: 'not_usable' }
  }
  return { data, reason: null }
}

/** Retired entry points intentionally perform no database operation. */
export async function applyRedemption() {
  return { ok: false, reason: 'operation_retired' }
}
export async function reverseRedemption() {
  return { ok: false, reason: 'operation_retired' }
}
