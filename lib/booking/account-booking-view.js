export const ACCOUNT_BOOKING_SELECT =
  'id,reference,service_id,staff_id,starts_at,status,customer_package_id,services(name,duration_minutes),staff(display_name),package_redemptions(customer_package_id,redeemed_at,refunded_at,customer_packages(sessions_remaining,total_sessions,packages(name)))'

function first(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

/** Return a serializable, customer-safe appointment shape for account pages and APIs. */
export function toAccountBooking(row) {
  const service = first(row?.services)
  const staff = first(row?.staff)
  const redemption = first(row?.package_redemptions)
  const customerPackage = first(redemption?.customer_packages)
  const packageInfo = first(customerPackage?.packages)
  return {
    id: row.id,
    reference: row.reference ?? null,
    serviceId: row.service_id,
    staffId: row.staff_id,
    startsAt: row.starts_at,
    timezone: 'Asia/Hong_Kong',
    status: row.status,
    service: service ? { name: service.name, durationMinutes: service.duration_minutes } : null,
    staff: staff ? { displayName: staff.display_name } : null,
    packageRedemption: redemption ? {
      packageId: redemption.customer_package_id,
      packageName: packageInfo?.name ?? null,
      redeemedAt: redemption.redeemed_at,
      refundedAt: redemption.refunded_at,
      sessionsRemaining: customerPackage?.sessions_remaining ?? null,
      totalSessions: customerPackage?.total_sessions ?? null,
    } : null,
  }
}
