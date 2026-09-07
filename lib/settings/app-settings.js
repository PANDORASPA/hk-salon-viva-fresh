/**
 * Single-row settings store backed by `public.app_settings`.
 *
 * The Settings admin tab writes a JSONB blob; server code (booking cancel,
 * cron reminders, notification dispatch) reads it with `readAppSettings()`.
 *
 * Falls back to safe defaults if the table is missing the row (e.g. the
 * migration has not been applied yet) so a half-deployed environment keeps
 * working instead of 500ing.
 *
 * The defaults intentionally mirror the prior env-var behaviour so the
 * system is no worse than before this migration shipped.
 */

const DEFAULTS = Object.freeze({
  reminder_hours_before: 24,
  cancel_cutoff_hours: 24,
  booking_buffer_minutes: 0,
  notify_email_enabled: true,
  notify_whatsapp_enabled: false,
  notify_console_enabled: true,
  notify_dry_run: true,
  auto_issue_packages: true,
  require_deposit: false,
  whatsapp_provider: 'off',
  email_provider: 'resend',
})

const NUMERIC_KEYS = new Set([
  'reminder_hours_before',
  'cancel_cutoff_hours',
  'booking_buffer_minutes',
])

const BOOLEAN_KEYS = new Set([
  'notify_email_enabled',
  'notify_whatsapp_enabled',
  'notify_console_enabled',
  'notify_dry_run',
  'auto_issue_packages',
  'require_deposit',
])

const STRING_KEYS = new Set(['whatsapp_provider', 'email_provider'])

function normaliseKey(key, value) {
  if (NUMERIC_KEYS.has(key)) {
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 ? n : DEFAULTS[key]
  }
  if (BOOLEAN_KEYS.has(key)) {
    if (typeof value === 'boolean') return value
    if (value === 'true' || value === 1 || value === '1') return true
    if (value === 'false' || value === 0 || value === '0') return false
    return DEFAULTS[key]
  }
  if (STRING_KEYS.has(key)) {
    return value == null ? DEFAULTS[key] : String(value)
  }
  return value
}

/**
 * Coerce an arbitrary object into the well-known settings shape. Unknown
 * keys are dropped; missing keys are filled from DEFAULTS. Invalid types
 * fall back to the default for that key.
 */
export function mergeSettings(input) {
  const out = { ...DEFAULTS }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  for (const key of Object.keys(DEFAULTS)) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      out[key] = normaliseKey(key, input[key])
    }
  }
  return out
}

/**
 * Read the current settings row. Returns DEFAULTS if the table is empty
 * (e.g. migration not yet applied) or the row is malformed. Never throws.
 *
 * Accepts a Supabase service client to keep the helper decoupled from the
 * request context — callers in the cron / booking paths can pass their
 * already-initialised client.
 */
export async function readAppSettings(db) {
  if (!db || typeof db.from !== 'function') return { ...DEFAULTS }
  try {
    const { data, error } = await db
      .from('app_settings')
      .select('data, updated_at')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return { ...DEFAULTS }
    return mergeSettings(data.data)
  } catch {
    return { ...DEFAULTS }
  }
}

export const __testing = { DEFAULTS, mergeSettings, normaliseKey }
export default { readAppSettings, mergeSettings, DEFAULTS, __testing }
