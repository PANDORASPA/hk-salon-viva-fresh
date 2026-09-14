import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createCspProxy } from './lib/security/request-policy.js'

export const proxy = createCspProxy({ NextResponse, createServerClient })

export const config = {
  // API handlers authenticate independently. Keep document/RSC auth coverage,
  // including prefetches; do not put nonce headers/no-store on static assets.
  matcher: ['/((?!api(?:/|$)|_next/static|_next/image|favicon\\.ico$|icon\\.svg$|og-image\\.svg$|gallery/|assets/|robots\\.txt$|sitemap\\.xml$).*)'],
}
