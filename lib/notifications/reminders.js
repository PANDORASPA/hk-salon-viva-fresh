import { formatAppointmentDateTime } from '../format.js'

const ELIGIBLE_STATUSES = ['pending', 'confirmed']

export function reminderWindow(now, reminderHours) {
  const start = new Date(now.getTime() + reminderHours * 60 * 60_000)
  const end = new Date(start.getTime() + 60 * 60_000)
  return { start, end }
}

function emailResult(status, reason) {
  return { ok: status === 'sent', status, ...(reason ? { reason } : {}) }
}

function reminderCopy(appointment, reminderHours, cancelCutoffHours) {
  const serviceName = appointment.services?.name || '服務'
  const startsAtHkd = formatAppointmentDateTime(appointment.starts_at)
  const subject = `【提醒】預約 #${appointment.id} 將於 ${reminderHours} 小時內開始 · SALON POKE BY VIVA`
  const text = [`${appointment.customer_name || '客戶'} 你好，`, '', '提醒你：你嘅預約將於以下時間進行 —', `預約編號：#${appointment.id}`, `服務：${serviceName}`, `時間：${startsAtHkd}`, '', '請於預約時間 5 分鐘前到達工作室。', `如需改期或取消，請最少提前 ${cancelCutoffHours} 小時通知我哋。`, '', 'SALON POKE BY VIVA'].join('\n')
  return { subject, text }
}

async function persistOutcome(db, id, claimToken, channelResults) {
  const { data, error } = await db.rpc('finalize_reminder_notification', { p_notification_id: id, p_claim_token: claimToken, p_channel_results: channelResults })
  const outcome = Array.isArray(data) ? data[0] : data
  return !error && Boolean(outcome?.finalized)
}

/** Claim before delivery, so concurrent cron instances cannot double-send. */
export async function dispatchReminders({ db, settings, now = new Date(), sendEmail }) {
  const reminderHours = Math.max(1, Math.min(168, Number(settings.reminder_hours_before) || 24))
  const { start, end } = reminderWindow(now, reminderHours)
  const { data: upcoming, error } = await db.from('appointments').select('id, starts_at, status, customer_name, customer_email, customer_phone, services(name, duration_minutes)').in('status', ELIGIBLE_STATUSES).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at', { ascending: true })
  if (error) throw error

  const results = { checked: upcoming?.length || 0, sent: 0, dry_run: 0, skipped: 0, failed: 0, items: [] }
  for (const appointment of upcoming || []) {
    const copy = reminderCopy(appointment, reminderHours, settings.cancel_cutoff_hours ?? 24)
    const { data, error: claimError } = await db.rpc('claim_reminder_notification', { p_booking_id: appointment.id, p_event: 'reminder', p_reminder_window_hours: reminderHours, p_customer_name: appointment.customer_name, p_customer_email: appointment.customer_email, p_starts_at: appointment.starts_at, p_email_subject: copy.subject, p_email_body: copy.text })
    const claim = Array.isArray(data) ? data[0] : data
    if (claimError || !claim) { results.failed += 1; results.items.push({ id: appointment.id, status: 'persistence_failed', reason: 'reminder_claim_failed' }); continue }
    if (!claim.claimed) { results.skipped += 1; results.items.push({ id: appointment.id, status: 'already_claimed' }); continue }

    const dryRun = process.env.NOTIFY_DRY_RUN === '1' || (process.env.NOTIFY_DRY_RUN !== '0' && settings.notify_dry_run)
    const outcome = !settings.notify_email_enabled
      ? emailResult('disabled', 'email_channel_disabled')
      : !appointment.customer_email
        ? emailResult('failed', 'no_recipient')
        : dryRun
          ? emailResult('dry_run', 'dry_run_enabled')
          : await sendEmail({ to: appointment.customer_email, subject: copy.subject, text: copy.text, idempotencyKey: `reminder:${appointment.id}:${reminderHours}` })
    if (!await persistOutcome(db, claim.notification_id, claim.claim_token, { email: outcome })) { results.failed += 1; results.items.push({ id: appointment.id, status: 'persistence_failed', reason: 'outcome_persist_failed' }); continue }
    if (outcome.status === 'sent') { results.sent += 1; results.items.push({ id: appointment.id, status: 'sent', messageId: outcome.id || null }) }
    else if (outcome.status === 'dry_run') { results.dry_run += 1; results.items.push({ id: appointment.id, status: 'dry_run' }) }
    else if (outcome.status === 'disabled') { results.skipped += 1; results.items.push({ id: appointment.id, status: 'disabled' }) }
    else { results.failed += 1; results.items.push({ id: appointment.id, status: 'failed', reason: outcome.reason || 'provider_error' }) }
  }
  return results
}

export const __testing = { reminderWindow, reminderCopy, emailResult }
