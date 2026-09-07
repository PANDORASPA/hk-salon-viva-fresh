import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../../../lib/admin/salon-api'

/**
 * POST /api/admin/customers/[id]/gdpr-delete
 *
 * Hard-delete the customer AND all their derived records:
 *   - customer_packages (FK cascade)
 *   - appointments (FK cascade)
 *   - package_redemptions (FK cascade)
 *   - notifications matching the customer email
 *
 * Cascading is handled by the DB schema (ON DELETE CASCADE on the
 * dependent tables). For notifications we also clear the matching
 * rows by email so the audit trail is complete.
 *
 * Writes a `customer.gdpr_delete` audit log entry including the
 * customer's id + email + number of dependent rows cleared.
 */
export async function POST(_request, { params }) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return jsonError('Invalid ID', 400)

  const db = ctx.db

  // Snapshot the customer so the audit log has the details even
  // after the row is gone.
  const { data: customer } = await db
    .from('customers').select('*').eq('id', id).maybeSingle()
  if (!customer) return jsonError('Not found', 404)

  const [pkgCount, aptCount, notifDel] = await Promise.all([
    db.from('customer_packages').select('id', { count: 'exact', head: true }).eq('customer_id', id),
    db.from('appointments').select('id', { count: 'exact', head: true }).eq('customer_id', id),
    customer.email
      ? db.from('notifications').delete().eq('customer_email', customer.email)
      : Promise.resolve({ error: null }),
  ])

  // Finally delete the customer row. Cascades through FKs to
  // customer_packages, appointments, and package_redemptions.
  const { error: delErr } = await db.from('customers').delete().eq('id', id)
  if (delErr) return jsonError(delErr)

  await audit(ctx.db, ctx.auth.user, 'customer.gdpr_delete', 'customers', id, {
    email: customer.email,
    phone: customer.phone,
    customer_packages_deleted: pkgCount.count ?? null,
    appointments_deleted: aptCount.count ?? null,
    notifications_deleted: notifDel?.error ? 'failed' : 'ok',
  })

  return NextResponse.json({
    deleted: {
      customer: id,
      customer_packages: pkgCount.count ?? null,
      appointments: aptCount.count ?? null,
      notifications: customer.email ? 'attempted' : 'skipped (no email)',
    },
  })
}
