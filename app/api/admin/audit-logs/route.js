import { NextResponse } from 'next/server'
import { adminContext, jsonError } from '../../../../lib/admin/salon-api'

/**
 * GET /api/admin/audit-logs?limit=100&offset=0&action=...
 *
 * Returns the admin audit log. Admin-only (via proxy.js + adminContext).
 * The table is append-only and rows are written by `tryWriteAdminAuditLog`
 * on every admin mutation, so this endpoint is the canonical "what did
 * admins do today" view.
 */
export async function GET(request) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response

  const url = new URL(request.url)
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)))
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))
  const action = url.searchParams.get('action')

  let query = ctx.db
    .from('admin_audit_logs')
    .select('id, actor_user_id, action, target_table, target_id, ip, user_agent, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (action) query = query.eq('action', action)

  const { data, error, count } = await query
  if (error) return jsonError(error)

  return NextResponse.json({
    auditLogs: data || [],
    pagination: { limit, offset, count: count ?? data?.length ?? 0 },
  })
}
