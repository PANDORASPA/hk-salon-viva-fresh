import { NextResponse } from 'next/server'
import { getServiceClient } from '../../../../lib/supabase/service'
import { sendEmail } from '../../../../lib/notifications/email.js'
import { formatAppointmentDateTime } from '../../../../lib/format'

/**
 * GET /api/cron/reminders
 *
 * Vercel cron target (configured in vercel.json, runs hourly):
 *   1. Find all appointments with starts_at between (now + 23h) and
 *      (now + 25h) — 1-hour window around the 24h mark
 *   2. For each, check the `notifications` table for an existing
 *      reminder_24h row (idempotency)
 *   3. Send a reminder email via the existing Resend dispatcher
 *   4. Record a `reminder_24h` notification row so we don't double-send
 *
 * Auth: requires a `?secret=<CRON_SECRET>` query param matching
 * process.env.CRON_SECRET. Vercel cron adds this automatically when
 * you set a secret on the cron job in the dashboard.
 */
export async function GET(request) {
  const url = new URL(request.url)
  const secret = url.searchParams.get('secret')
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured on server.' }, { status: 500 })
  }
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()
  if (!db) {
    return NextResponse.json({ error: 'Supabase service role not configured.' }, { status: 500 })
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() + 23 * 60 * 60_000)
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60_000)

  const { data: upcoming, error } = await db
    .from('appointments')
    .select('id, starts_at, status, customer_name, customer_email, customer_phone, services(name, duration_minutes)')
    .in('status', ['pending', 'confirmed'])
    .gte('starts_at', windowStart.toISOString())
    .lt('starts_at', windowEnd.toISOString())
    .order('starts_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = { checked: upcoming?.length || 0, sent: 0, skipped: 0, failed: 0, items: [] }

  for (const apt of upcoming || []) {
    if (!apt.customer_email) {
      results.skipped += 1
      results.items.push({ id: apt.id, status: 'no_email' })
      continue
    }
    // Idempotency: skip if we already sent a reminder_24h for this booking
    const { data: existing } = await db
      .from('notifications')
      .select('id')
      .eq('booking_id', apt.id)
      .eq('event', 'reminder_24h')
      .maybeSingle()
    if (existing) {
      results.skipped += 1
      results.items.push({ id: apt.id, status: 'already_sent' })
      continue
    }

    const startsAtHkd = formatAppointmentDateTime(apt.starts_at)
    const serviceName = apt.services?.name || '服務'
    const subject = `【提醒】預約 #${apt.id} 將於 24 小時內開始 · SALON POKE BY VIVA`
    const text = [
      `${apt.customer_name || '客戶'} 你好，`,
      ``,
      `提醒你：你嘅預約將於以下時間進行 —`,
      `預約編號：#${apt.id}`,
      `服務：${serviceName}`,
      `時間：${startsAtHkd}`,
      ``,
      `請於預約時間 5 分鐘前到達工作室。`,
      `如需改期或取消，請最少提前 24 小時通知我哋。`,
      ``,
      `SALON POKE BY VIVA`,
    ].join('\n')
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;line-height:1.6;color:#2c2826">
      <h2 style="margin:0 0 16px;color:#a98152;font-weight:600">24 小時內提醒</h2>
      <p>${apt.customer_name || '客戶'} 你好，</p>
      <p>提醒你：你嘅預約將於以下時間進行 —</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#706961">預約編號</td><td style="padding:6px 0">#${apt.id}</td></tr>
        <tr><td style="padding:6px 0;color:#706961">服務</td><td style="padding:6px 0">${serviceName}</td></tr>
        <tr><td style="padding:6px 0;color:#706961">時間</td><td style="padding:6px 0">${startsAtHkd}</td></tr>
      </table>
      <p>請於預約時間 5 分鐘前到達工作室。如需改期或取消，請最少提前 24 小時通知我哋。</p>
      <hr style="border:none;border-top:1px solid #ded5c8;margin:24px 0">
      <p style="color:#706961;font-size:12px">SALON POKE BY VIVA · 爆毛術脫髮護理</p>
    </div>`

    const emailResult = await sendEmail({ to: apt.customer_email, subject, text, html })
    if (!emailResult.ok) {
      results.failed += 1
      results.items.push({ id: apt.id, status: 'failed', reason: emailResult.reason })
      continue
    }
    // Record so we don't re-send next hour
    await db.from('notifications').insert({
      event: 'reminder_24h',
      booking_id: apt.id,
      customer_name: apt.customer_name,
      customer_email: apt.customer_email,
      starts_at: apt.starts_at,
      email_subject: subject,
      email_body: text,
      channel_results: { email: emailResult },
    })
    results.sent += 1
    results.items.push({ id: apt.id, status: 'sent', mode: emailResult.mode })
  }

  return NextResponse.json(results)
}
