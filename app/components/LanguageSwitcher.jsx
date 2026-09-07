'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

const LABELS = {
  'zh-HK': '繁體中文',
  'en': 'English',
}

/**
 * Two-state language switcher. Sets the `lang` cookie (one year, path=/)
 * then refreshes the current route so server components re-render in the
 * new locale. Avoids URL rewriting — locale lives in the cookie so the
 * canonical URL stays the same and search engines don't see duplicate
 * paths for every language.
 */
export default function LanguageSwitcher({ current = 'zh-HK' }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const next = current === 'zh-HK' ? 'en' : 'zh-HK'

  const switchTo = () => {
    start(() => {
      // 365 days, root path
      document.cookie = `lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      className="admin-action"
      onClick={switchTo}
      disabled={pending}
      aria-label={`Switch language (${LABELS[current]} → ${LABELS[next]})`}
      style={{ minWidth: 100 }}
    >
      {pending ? '…' : `${LABELS[current]} → ${LABELS[next]}`}
    </button>
  )
}
