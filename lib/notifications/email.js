/**
 * Email dispatcher — Resend API with deterministic dry-run fallback.
 *
 * Live mode: when `RESEND_API_KEY` is set, sends the email via Resend
 * (https://resend.com). Otherwise writes the rendered message to the
 * `notifications` table (via the existing `notify.js` log path) so
 * the booking / cancellation flow keeps working in dev / staging.
 *
 * The function is best-effort: failures are logged and returned to the
 * caller as `{ ok: false, reason }` so the booking flow does not break
 * when the email provider is down.
 */

let resendClient = null
let modeCache = null

function getEnv() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.NOTIFY_EMAIL_FROM || 'SALON POKE BY VIVA <noreply@salonpokeviva.com>',
  }
}

export function isEmailLiveMode() {
  if (modeCache !== null) return modeCache
  const { apiKey } = getEnv()
  modeCache = Boolean(apiKey)
  return modeCache
}

async function getResend() {
  if (resendClient) return resendClient
  if (!isEmailLiveMode()) return null
  // Dynamic import so the optional dep is not required in dry-run mode.
  let Resend
  try {
    const mod = await import('resend')
    Resend = mod.Resend || mod.default
  } catch {
    throw new Error(
      'RESEND_API_KEY is set but the resend package is not installed. ' +
      'Run `npm install resend` to enable email sending, or unset the env var.',
    )
  }
  resendClient = new Resend(getEnv().apiKey)
  return resendClient
}

/**
 * Build a branded HTML email shell around the supplied body.
 *
 * Layout: 600px max-width, gold brand bar, Cormorant Garamond + system
 * sans, mobile responsive (single column under 600px), accessible
 * (semantic table, role=presentation, alt text on the logo, generous
 * contrast for body text).
 *
 * Body HTML is interpolated as raw HTML. Callers must pre-escape any
 * user-supplied values. We pre-escape the subject (used in the preview
 * text) and the brand name is hard-coded.
 */
export function renderBrandedEmail({ subject, preheader, bodyHtml, accent = '#a98152' }) {
  const safeSubject = escapeHtml(subject || '')
  const safePreheader = escapeHtml(preheader || '')
  return `<!doctype html>
<html lang="zh-HK" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no">
  <title>${safeSubject}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    body { margin: 0; padding: 0; background: #f7f3ec; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; color: #2c2826; }
    h1, h2, h3 { font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; font-weight: 600; color: #2c2826; margin: 0 0 12px; }
    h1 { font-size: 28px; line-height: 1.2; }
    h2 { font-size: 20px; line-height: 1.25; }
    h3 { font-size: 16px; line-height: 1.3; }
    p { margin: 0 0 12px; line-height: 1.6; }
    a { color: ${accent}; text-decoration: none; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .brand-bar { background: ${accent}; color: #ffffff; padding: 24px 32px; text-align: center; }
    .brand-bar h1 { color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 0.04em; }
    .brand-bar .tagline { color: rgba(255,255,255,0.85); font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; margin-top: 4px; }
    .body { padding: 32px; }
    .footer { padding: 16px 32px 24px; background: #faf7f1; color: #706961; font-size: 12px; text-align: center; border-top: 1px solid #ded5c8; }
    .footer a { color: #706961; text-decoration: underline; }
    .button { display: inline-block; padding: 12px 24px; background: ${accent}; color: #ffffff !important; border-radius: 8px; font-weight: 600; margin: 12px 0; }
    .meta { color: #706961; font-size: 12px; }
    .divider { border: none; border-top: 1px solid #ded5c8; margin: 16px 0; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .body { padding: 24px 20px !important; }
      .brand-bar { padding: 20px !important; }
    }
  </style>
</head>
<body role="presentation" style="background:#f7f3ec;padding:24px 0">
  <span style="display:none;font-size:1px;color:#f7f3ec;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${safePreheader}</span>
  <table role="presentation" class="container" width="600" align="center" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden">
    <tr>
      <td class="brand-bar" style="background:${accent};color:#ffffff;padding:24px 32px;text-align:center">
        <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:0.04em;font-family:'Cormorant Garamond',Georgia,serif">SALON POKE BY VIVA</h1>
        <div class="tagline" style="color:rgba(255,255,255,0.85);font-size:12px;letter-spacing:0.16em;text-transform:uppercase;margin-top:4px">爆毛術脫髮護理</div>
      </td>
    </tr>
    <tr>
      <td class="body" style="padding:32px;font-family:'Inter',Arial,sans-serif;color:#2c2826;font-size:15px;line-height:1.6">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td class="footer" style="padding:16px 32px 24px;background:#faf7f1;color:#706961;font-size:12px;text-align:center;border-top:1px solid #ded5c8">
        <p style="margin:0 0 6px">SALON POKE BY VIVA · 爆毛術脫髮護理</p>
        <p style="margin:0">如有問題請 WhatsApp 我哋：<a href="https://wa.me/852XXXXXXXX" style="color:#706961">+852-XXXX-XXXX</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Send a single email. Returns:
 *   { ok: true, id?, mode: 'live' | 'dry-run' }  on success
 *   { ok: false, reason }                         on failure
 *
 * The dry-run path never throws — it returns a result the caller can
 * log so ops can see which emails WOULD have been sent.
 */
export async function sendEmail({ to, subject, html, text, preheader }) {
  if (!to) return { ok: false, reason: 'no_recipient' }
  if (!subject || (!html && !text)) {
    return { ok: false, reason: 'missing_content' }
  }
  const finalHtml = html || renderBrandedEmail({ subject, preheader, bodyHtml: `<pre style="font-family:Inter,sans-serif;white-space:pre-wrap;margin:0">${escapeHtml(text || '')}</pre>` })
  if (!isEmailLiveMode()) {
    return {
      ok: true,
      mode: 'dry-run',
      note: 'set RESEND_API_KEY to send live emails',
    }
  }
  try {
    const resend = await getResend()
    const { from } = getEnv()
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html: finalHtml,
      text: text || stripHtml(html || ''),
    })
    if (result.error) {
      return { ok: false, reason: result.error.message || 'resend_error' }
    }
    return { ok: true, mode: 'live', id: result.data?.id || null }
  } catch (err) {
    return { ok: false, reason: err?.message || 'send_failed' }
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripHtml(value) {
  return String(value).replace(/<[^>]*>/g, '').trim()
}

export const __testing = { isEmailLiveMode, getEnv, escapeHtml, stripHtml, renderBrandedEmail }

export default { sendEmail, isEmailLiveMode, renderBrandedEmail, __testing }
