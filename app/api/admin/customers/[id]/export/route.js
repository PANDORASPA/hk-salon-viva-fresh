import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../../../lib/admin/salon-api'

/**
 * GET /api/admin/customers/[id]/export
 *
 * GDPR-style data export. Returns a single JSON payload containing
 * every row the salon holds for the customer, with a top-level
 * `exportedAt` timestamp and the admin user who triggered it.
 *
 * The response is served as `application/json` with a Content-Disposition
 * attachment so the admin can save it to disk.
 */
export async function GET(_request, { params }) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return jsonError('Invalid ID', 400)

  const db = ctx.db

  const [customerRes, packagesRes, appointmentsRes, notificationsRes] = await Promise.all([
    db.from('customers').select('*').eq('id', id).maybeSingle(),
    db.from('customer_packages')
      .select('id, package_id, total_sessions, sessions_remaining, is_active, expires_at, purchased_at, packages(name, colour_hex)')
      .eq('customer_id', id),
    db.from('appointments')
      .select('id, service_id, starts_at, ends_at, status, customer_package_id, customer_name, customer_phone, customer_email, admin_notes, services(name, duration_minutes)')
      .eq('customer_id', id),
    db.from('notifications')
      .select('id, event, booking_id, customer_name, customer_email, starts_at, email_subject, email_body, whatsapp_body, delivered_at, channel_results')
      .or(`customer_email.eq.${(await db.from('customers').select('email').eq('id', id).maybeSingle()).data?.email ?? ''}`),
  ])

  if (customerRes.error) return jsonError(customerRes.error)
  if (!customerRes.data) return jsonError('Not found', 404)

  const payload = {
    exportedAt: new Date().toISOString(),
    exportedBy: ctx.auth.user?.email || null,
    customer: customerRes.data,
    packages: packagesRes.data || [],
    appointments: appointmentsRes.data || [],
    notifications: notificationsRes.data || [],
    schema: {
      tables: ['customers', 'customer_packages', 'appointments', 'notifications'],
      version: 1,
    },
  }

  await audit(ctx.db, ctx.auth.user, 'customer.export', 'customers', id, {
    packages: payload.packages.length,
    appointments: payload.appointments.length,
    notifications: payload.notifications.length,
  })

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="customer-${id}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
