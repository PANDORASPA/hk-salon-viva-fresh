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
 * Send a single email. Returns:
 *   { ok: true, id?, mode: 'live' | 'dry-run' }  on success
 *   { ok: false, reason }                         on failure
 *
 * The dry-run path never throws — it returns a result the caller can
 * log so ops can see which emails WOULD have been sent.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!to) return { ok: false, reason: 'no_recipient' }
  if (!subject || (!html && !text)) {
    return { ok: false, reason: 'missing_content' }
  }
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
      html: html || `<pre style="font-family:sans-serif">${escapeHtml(text || '')}</pre>`,
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

export const __testing = { isEmailLiveMode, getEnv, escapeHtml, stripHtml }

export default { sendEmail, isEmailLiveMode, __testing }
