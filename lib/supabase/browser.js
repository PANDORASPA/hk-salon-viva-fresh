'use client'

import { createBrowserClient } from '@supabase/ssr'

let browserClient

export function getBrowserClient() {
  if (browserClient) return browserClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase public environment variables')
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return browserClient
}

