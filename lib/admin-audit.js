const text = (value) => String(value || '').trim()

const requestIp = (request) =>
  text(request?.headers?.get?.('x-forwarded-for')).split(',')[0].trim() || text(request?.headers?.get?.('x-real-ip'))

export async function writeAdminAuditLog({
  supabase,
  request,
  actorUserId,
  action,
  targetTable,
  targetId,
  beforeData = null,
  afterData = null,
}) {
  if (!supabase || !action) return

  await supabase.from('admin_audit_logs').insert({
    actor_user_id: actorUserId || null,
    action: text(action),
    target_table: text(targetTable) || null,
    target_id: targetId == null ? null : String(targetId),
    before_data: beforeData,
    after_data: afterData,
    ip: requestIp(request) || null,
    user_agent: text(request?.headers?.get?.('user-agent')) || null,
  })
}

export async function tryWriteAdminAuditLog(input) {
  try {
    await writeAdminAuditLog(input)
  } catch {
    // Audit logging must not break customer-facing payment or booking flows.
  }
}
