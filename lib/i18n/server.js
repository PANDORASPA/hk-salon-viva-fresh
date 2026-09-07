/**
 * Server-side locale resolution.
 *
 * Order of preference:
 *   1. The `lang` cookie set by the LanguageSwitcher
 *   2. The `Accept-Language` header (parsed by pickLocale)
 *   3. The DEFAULT_LOCALE
 *
 * Cached per request via React's `cache()`.
 */

import { cookies, headers } from 'next/headers'
import { pickLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from './dict'
import { cache } from 'react'

export const getLocale = cache(() => {
  // 1) Cookie
  try {
    const c = cookies().get('lang')?.value
    if (c && SUPPORTED_LOCALES.includes(c)) return c
  } catch {
    // cookies() may throw in non-RSC contexts; ignore
  }

  // 2) Accept-Language
  try {
    const accept = headers().get('accept-language') || ''
    const candidates = accept
      .split(',')
      .map((part) => {
        const [tag, ...rest] = part.trim().split(';')
        const q = rest.find((p) => p.startsWith('q='))
        const weight = q ? Number(q.slice(2)) : 1
        return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 1 }
      })
      .filter((c) => c.tag)
      .sort((a, b) => b.weight - a.weight)
      .map((c) => c.tag)
    if (candidates.length) return pickLocale(candidates)
  } catch {
    // ignore
  }

  return DEFAULT_LOCALE
})
