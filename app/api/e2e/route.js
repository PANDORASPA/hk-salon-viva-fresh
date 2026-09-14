import { NextResponse } from 'next/server.js'
import { bindingFor, canonicalE2EUrl, verifyDatabaseMarker } from '../../../lib/e2e/runtime-preflight.mjs'
import { getServiceClient } from '../../../lib/supabase/service.js'

export function createE2EProbeHandler({ env = process.env, getServiceClient: serviceClient = getServiceClient } = {}) {
  return async function e2eProbe() {
    const marker = env.E2E_DATABASE_MARKER
    if (env.NODE_ENV === 'production' || ['production', 'preview'].includes(env.VERCEL_ENV)
      || env.E2E_PROBE_ENABLED !== '1' || !marker || !env.NEXT_PUBLIC_SUPABASE_URL) return new NextResponse(null, { status: 404 })
    let supabase
    try { supabase = canonicalE2EUrl('NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL) }
    catch { return new NextResponse(null, { status: 404 }) }
    try {
      await verifyDatabaseMarker(await serviceClient(), marker)
      return NextResponse.json({ e2e: true, binding: bindingFor(marker, supabase.origin) }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
    } catch { return new NextResponse(null, { status: 404 }) }
  }
}

export const GET = createE2EProbeHandler()
