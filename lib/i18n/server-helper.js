// Tiny re-export so server components that import this file (e.g.
// app/not-found.js) don't have to wait for `next/headers` cookies()
// which can throw outside of a request context. Wraps the same
// logic as lib/i18n/server.js but without the React `cache()` call so
// it can be safely awaited from any server entry point.
import { cookies, headers } from 'next/headers'
import { pickLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from './dict'

export async function getLocale() {
  try {
    const c = cookies().get('lang')?.value
    if (c && SUPPORTED_LOCALES.includes(c)) return c
  } catch {}
  try {
    const accept = headers().get('accept-language') || ''
    const candidates = accept.split(',').map((p) => p.split(';')[0].trim()).filter(Boolean)
    if (candidates.length) return pickLocale(candidates)
  } catch {}
  return DEFAULT_LOCALE
}
