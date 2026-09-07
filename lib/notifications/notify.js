/**
 * Notification dispatch — booking confirmations + cancellations.
 *
 * Channel model:
 *  - `console`  : always on. Logs the rendered message + payload for ops
 *                 debugging and so the team can replay the message manually
 *                 via WhatsApp web if the live channel is not configured.
 *  - `supabase` : writes a row to the `notifications` table. RLS makes the
 *                 table admin-only, so customers never see other customers'
 *                 notifications.
 *  - `whatsapp` : stub. A real implementation should POST to the WhatsApp
 *                 Business Cloud API (or Twilio) here. The function returns
 *                 the rendered message + recipient so the integration is
 *                 trivially swappable.
 *  - `email`    : stub. A real implementation should use Resend / Postmark /
 *                 SES here.
 *
 * Configuration is via env vars (none required for the default behaviour):
 *   NOTIFY_WHATSAPP_PROVIDER=twilio|cloud|off     (default: off)
 *   NOTIFY_EMAIL_PROVIDER=resend|off             (default: off)
 *   NOTIFY_DRY_RUN=1                            (default: on; set 0 to allow
 *                                                external HTTP calls in prod)
 *
 * All dispatched notifications are best-effort: failures are logged but do
 * not break the booking / cancellation flow.
 */

import { createClient } from '@supabase/supabase-js'
import { sendEmail, isEmailLiveMode } from './email.js'

const DRY_RUN = process.env.NOTIFY_DRY_RUN !== '0'

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const TEMPLATES = {
  booking_confirmation: ({ booking, service, customerName, customerPhone, customerEmail, startsAtHkd }) => ({
    whatsapp: {
      to: customerPhone,
      body:
        `【SALON POKE BY VIVA · 預約確認】\n` +
        `${customerName} 你好！\n` +
        `我哋已收到你嘅預約申請 #${booking.id}\n` +
        `服務：${service?.name || '服務'}\n` +
        `時間：${startsAtHkd}\n` +
        `請於預約時間 5 分鐘前到達工作室。\n` +
        `如需改期或取消，請最少提前 24 小時通知我哋。\n` +
        `謝謝！`,
    },
    email: {
      to: customerEmail,
      subject: `預約確認 #${booking.id} · SALON POKE BY VIVA`,
      body:
        `${customerName} 你好，\n\n` +
        `我哋已收到你嘅預約申請。\n` +
        `預約編號：#${booking.id}\n` +
        `服務：${service?.name || '服務'}\n` +
        `時間：${startsAtHkd}\n\n` +
        `請於預約時間 5 分鐘前到達工作室。\n` +
        `如需改期或取消，請最少提前 24 小時通知我哋。\n\n` +
        `SALON POKE BY VIVA`,
    },
  }),
  booking_cancellation: ({ booking, customerName, customerPhone, customerEmail, packageRefunded, startsAtHkd }) => ({
    whatsapp: {
      to: customerPhone,
      body:
        `【SALON POKE BY VIVA · 預約取消】\n` +
        `${customerName} 你的預約 #${booking.id}（${startsAtHkd}）已取消。\n` +
        (packageRefunded
          ? `已使用套票嘅一次扣減已自動退返，唔使擔心。\n`
          : ``) +
        `如要重新預約，請到 https://salon-poke-by-viva.vercel.app/booking 謝謝！`,
    },
    email: {
      to: customerEmail,
      subject: `預約取消確認 #${booking.id} · SALON POKE BY VIVA`,
      body:
        `${customerName} 你好，\n\n` +
        `你嘅預約 #${booking.id}（${startsAtHkd}）已取消。\n` +
        (packageRefunded
          ? `已使用套票嘅一次扣減已自動退返，唔使擔心。\n\n`
          : `\n`) +
        `如要重新預約，請到 https://salon-poke-by-viva.vercel.app/booking 。\n\n` +
        `SALON POKE BY VIVA`,
    },
  }),
  booking_reschedule: ({ booking, customerName, customerPhone, customerEmail, startsAtHkd, prevStartsAtHkd }) => ({
    whatsapp: {
      to: customerPhone,
      body:
        `【SALON POKE BY VIVA · 預約改期】\n` +
        `${customerName} 你的預約 #${booking.id} 已由 ${prevStartsAtHkd} 改為 ${startsAtHkd}。` +
        (booking.customer_package_id
          ? ` 已重新扣減套票一次。`
          : ``) +
        ` 如有問題請 WhatsApp 我哋。`,
    },
    email: {
      to: customerEmail,
      subject: `預約改期確認 #${booking.id} · SALON POKE BY VIVA`,
      body:
        `${customerName} 你好，\n\n` +
        `你嘅預約 #${booking.id} 已由 ${prevStartsAtHkd} 改為 ${startsAtHkd}。\n` +
        (booking.customer_package_id ? `已重新扣減套票一次。\n\n` : `\n`) +
        `SALON POKE BY VIVA`,
    },
  }),
}

function render(templateName, ctx) {
  const tpl = TEMPLATES[templateName]
  if (!tpl) throw new Error(`unknown notification template: ${templateName}`)
  return tpl(ctx)
}

function formatHkTime(value) {
  if (!value) return '時間待確認'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '時間待確認'
  return date.toLocaleString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function isMissingContact(ctx) {
  return !ctx.customerPhone && !ctx.customerEmail
}

async function logToSupabase(record) {
  const db = serviceClient()
  if (!db) return
  try {
    await db.from('notifications').insert(record)
  } catch (err) {
    console.error('[notify] supabase insert failed', err?.message || err)
  }
}

/**
 * Send a booking-related notification. Always logs to console + Supabase.
 * External channels (WhatsApp / email) are stubbed in this build.
 */
export async function sendBookingNotification({ event, booking, service, prevStartsAt, packageRefunded = false }) {
  if (!booking) throw new Error('sendBookingNotification: booking required')
  if (!event) throw new Error('sendBookingNotification: event required')

  const ctx = {
    booking,
    service,
    customerName: booking.customer_name || '客戶',
    customerPhone: booking.customer_phone,
    customerEmail: booking.customer_email,
    startsAtHkd: formatHkTime(booking.starts_at),
    prevStartsAtHkd: formatHkTime(prevStartsAt),
    packageRefunded,
  }

  if (isMissingContact(ctx)) {
    console.warn('[notify] no contact info on booking', booking.id)
    return { ok: false, reason: 'no_contact' }
  }

  const rendered = render(event, ctx)
  const channels = []
  const results = {}

  // 1) console — always
  console.log(`[notify] event=${event} booking_id=${booking.id}`)
  console.log(`  whatsapp.to=${rendered.whatsapp.to}`)
  console.log(`  whatsapp.body=${rendered.whatsapp.body}`)
  if (rendered.email.to) {
    console.log(`  email.to=${rendered.email.to}`)
    console.log(`  email.subject=${rendered.email.subject}`)
  }
  channels.push('console')
  results.console = { ok: true }

  // 2) supabase audit log
  const record = {
    event,
    booking_id: booking.id,
    customer_name: ctx.customerName,
    customer_phone: ctx.customerPhone,
    customer_email: ctx.customerEmail,
    starts_at: booking.starts_at,
    whatsapp_body: rendered.whatsapp.body,
    email_subject: rendered.email.subject,
    email_body: rendered.email.body,
    package_refunded: packageRefunded,
  }
  await logToSupabase(record)
  channels.push('supabase')
  results.supabase = { ok: true }

  // 3) whatsapp (stub)
  if (DRY_RUN || process.env.NOTIFY_WHATSAPP_PROVIDER === 'off' || !process.env.NOTIFY_WHATSAPP_PROVIDER) {
    results.whatsapp = { ok: false, mode: 'dry_run', reason: 'no provider configured' }
  } else {
    // TODO: implement Twilio or WhatsApp Cloud call here
    results.whatsapp = { ok: false, mode: 'stub', reason: 'not yet implemented' }
  }

  // 4) email — Resend when RESEND_API_KEY is set, otherwise dry-run
  if (rendered.email.to) {
    const emailResult = await sendEmail({
      to: rendered.email.to,
      subject: rendered.email.subject,
      text: rendered.email.body,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;line-height:1.6;color:#2c2826">
        <p>${rendered.email.body.replace(/\n/g, '<br>')}</p>
        <hr style="border:none;border-top:1px solid #ded5c8;margin:24px 0">
        <p style="color:#706961;font-size:12px">SALON POKE BY VIVA · 爆毛術脫髮護理</p>
      </div>`,
    })
    results.email = emailResult
    if (emailResult.ok && emailResult.mode === 'live') channels.push('email')
  } else {
    results.email = { ok: false, reason: 'no email address' }
  }

  return { ok: true, channels, results }
}

export const __testing = { render, formatHkTime, TEMPLATES }

export default { sendBookingNotification, __testing }
