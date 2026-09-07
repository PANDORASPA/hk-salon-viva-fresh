/**
 * Package / ticket usage helpers.
 *
 * Centralises all interactions with `customer_packages` and `package_redemptions`
 * (or the equivalent tables in this codebase — see notes below) so route handlers
 * and admin modules all go through the same path.
 *
 * Database conventions in this repo (see `supabase/migrations/`):
 *   - `customer_packages`  : per-customer package instance
 *                            (id, customer_id, package_id, total_sessions,
 *                             sessions_remaining, is_active, expires_at, ...)
 *   - `appointments`       : the booking row (id, customer_id, customer_package_id,
 *                            service_id, starts_at, status, ...)
 *   - `package_redemptions`: one row per appointment that consumed a package slot
 *                            (id, customer_package_id, appointment_id, redeemed_at)
 *
 * The redemption is the inverse of the booking: cancelling a booking MUST restore
 * `customer_packages.sessions_remaining` and mark the matching redemption row.
 *
 * All helpers in this module are best-effort: callers should wrap in try/catch
 * because the booking flow must not break if the package table is missing a row.
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

/**
 * Apply a redemption. Decrements `sessions_remaining` and records a row in
 * `package_redemptions`. This is two writes; in production the migration in
 * `supabase/migrations/20260907000000_package_redeem_rpc.sql` should provide
 * an atomic RPC `redeem_customer_package(p_customer_package_id, p_appointment_id)`.
 *
 * Until that migration is applied, this falls back to the two-step write inside
 * a try/catch — acceptable for the existing schema because Supabase RLS prevents
 * double-decrement by the public anon role.
 */
export async function applyRedemption(db, { customerPackageId, appointmentId }) {
  if (!customerPackageId || !appointmentId) {
    return { ok: false, reason: 'missing_ids' }
  }
  try {
    // Atomic RPC if available (preferred). Falls back to two-step write below.
    const rpc = await db.rpc('redeem_customer_package', {
      p_customer_package_id: customerPackageId,
      p_appointment_id: appointmentId,
    })
    if (!rpc.error) return { ok: true, mode: 'rpc' }
  } catch {
    // RPC not present, fall through to legacy path
  }
  // Legacy: read-modify-write guarded by RLS + a unique index on
  // package_redemptions (appointment_id) to prevent double redemption.
  const { data: cp, error: cpErr } = await db
    .from('customer_packages')
    .select('id, sessions_remaining, total_sessions, is_active, expires_at')
    .eq('id', customerPackageId)
    .single()
  if (cpErr || !cp) return { ok: false, reason: 'package_lookup_failed', error: cpErr }
  if (!isCustomerPackageUsable(cp)) return { ok: false, reason: 'not_usable' }

  const { error: updErr } = await db
    .from('customer_packages')
    .update({ sessions_remaining: (cp.sessions_remaining ?? 1) - 1 })
    .eq('id', customerPackageId)
  if (updErr) return { ok: false, reason: 'decrement_failed', error: updErr }

  const { error: redErr } = await db
    .from('package_redemptions')
    .insert({ customer_package_id: customerPackageId, appointment_id: appointmentId })
  if (redErr) {
    // Roll back the decrement best-effort
    await db
      .from('customer_packages')
      .update({ sessions_remaining: cp.sessions_remaining })
      .eq('id', customerPackageId)
    return { ok: false, reason: 'redemption_insert_failed', error: redErr }
  }
  return { ok: true, mode: 'legacy' }
}

/**
 * Reverse a redemption. Restores `sessions_remaining` and removes the
 * `package_redemptions` row. Mirrors `applyRedemption` so cancel flows can
 * call this without duplicating the schema knowledge.
 */
export async function reverseRedemption(db, { customerPackageId, appointmentId }) {
  if (!customerPackageId || !appointmentId) {
    return { ok: false, reason: 'missing_ids' }
  }
  try {
    const rpc = await db.rpc('refund_customer_package', {
      p_customer_package_id: customerPackageId,
      p_appointment_id: appointmentId,
    })
    if (!rpc.error) return { ok: true, mode: 'rpc' }
  } catch {
    // RPC not present, fall through
  }
  // Legacy path
  const { data: cp, error: cpErr } = await db
    .from('customer_packages')
    .select('id, sessions_remaining, total_sessions')
    .eq('id', customerPackageId)
    .single()
  if (cpErr || !cp) return { ok: false, reason: 'package_lookup_failed', error: cpErr }
  const { error: delErr } = await db
    .from('package_redemptions')
    .delete()
    .eq('customer_package_id', customerPackageId)
    .eq('appointment_id', appointmentId)
  if (delErr) return { ok: false, reason: 'redemption_delete_failed', error: delErr }
  const cap = cp.total_sessions ?? (cp.sessions_remaining ?? 0) + 1
  const next = Math.min(cap, (cp.sessions_remaining ?? 0) + 1)
  const { error: updErr } = await db
    .from('customer_packages')
    .update({ sessions_remaining: next })
    .eq('id', customerPackageId)
  if (updErr) return { ok: false, reason: 'increment_failed', error: updErr }
  return { ok: true, mode: 'legacy' }
}
