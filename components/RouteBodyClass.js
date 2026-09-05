'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const AUTH_PATHS = ['/register', '/login', '/account']

export default function RouteBodyClass() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof document === 'undefined') return

    const isAuthPage = AUTH_PATHS.some((path) => pathname === path || pathname?.startsWith(`${path}/`))
    document.body.classList.toggle('auth-page', Boolean(isAuthPage))

    return () => {
      document.body.classList.remove('auth-page')
    }
  }, [pathname])

  return null
}
