import { NextResponse } from 'next/server.js'
import { adminContext, jsonError } from '../../../../lib/admin/salon-api.js'

const hkDay = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
const hkMidnight = day => new Date(`${day}T00:00:00+08:00`).toISOString()
const failed = results => Object.values(results || {}).some(result => {
  const state = result?.status || result?.mode
  return state === 'failed' || (result?.ok === false && !['disabled', 'dry_run'].includes(state))
})
const packageView = row => ({ id: row.id, expiresAt: row.expires_at, sessionsRemaining: row.sessions_remaining, customerName: row.customers?.name || '客戶', packageName: row.packages?.name || '套票' })
const notificationView = row => ({ id: row.id, event: row.event, bookingId: row.booking_id, deliveredAt: row.delivered_at })
export const __testing = { failed }

export function createAdminOperationsHandler({ adminContext: resolveContext = () => adminContext() } = {}) {
  return { async GET() {
    const context = await resolveContext()
    if (context.response) return context.response
    const today = hkDay(new Date())
    const tomorrow = new Date(`${today}T00:00:00+08:00`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const expires = new Date(`${today}T00:00:00+08:00`); expires.setUTCDate(expires.getUTCDate() + 31)
    const now = new Date().toISOString()
    const [total, pending, packages, notifications, staff, services] = await Promise.all([
      context.db.from('appointments').select('id', { count: 'exact', head: true }).gte('starts_at', hkMidnight(today)).lt('starts_at', tomorrow.toISOString()),
      context.db.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'pending').gte('starts_at', hkMidnight(today)).lt('starts_at', tomorrow.toISOString()),
      context.db.from('customer_packages').select('id,expires_at,sessions_remaining,customers(name),packages(name)').gte('expires_at', now).lt('expires_at', expires.toISOString()).eq('is_active', true).order('expires_at').limit(20),
      context.db.from('notifications').select('id,event,booking_id,delivered_at,channel_results').order('delivered_at', { ascending: false }).limit(100),
      context.db.from('staff').select('id,name,display_name,is_active,sort_order').eq('is_active', true).order('sort_order').order('id'),
      context.db.from('services').select('id,name').eq('published', true).order('sort_order'),
    ])
    if ([total, pending, packages, notifications, staff, services].some(result => result.error)) return jsonError('Unable to load operations dashboard.', 500)
    return NextResponse.json({
      today: { date: today, total: total.count || 0, pending: pending.count || 0 },
      expiringPackages: (packages.data || []).map(packageView), failedNotifications: (notifications.data || []).filter(row => failed(row.channel_results)).map(notificationView),
      staff: (staff.data || []).map(row => ({ id: row.id, name: row.display_name || row.name })), services: (services.data || []).map(row => ({ id: row.id, name: row.name })),
    })
  } }
}

export async function GET() { return createAdminOperationsHandler().GET() }
