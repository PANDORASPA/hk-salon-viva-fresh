/**
 * Resolves the explicit runtime override before the saved application setting.
 * Only the documented values have override semantics; an unset or unexpected
 * value continues to defer to the persisted safe/default setting.
 */
export function resolveNotificationDryRun(envValue, savedValue) {
  if (envValue === '1') return true
  if (envValue === '0') return false
  return Boolean(savedValue)
}
