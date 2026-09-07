import { NextResponse } from 'next/server'

/**
 * GET /api/health
 *
 * Liveness / readiness probe. Returns 200 with `{ ok: true, ts }`
 * as long as the Next.js runtime is up. Designed for Vercel /
 * uptime monitors / load balancer health checks.
 *
 * Cheap by design: no Supabase call, no env inspection. The
 * companion deep check lives at /api/health/deep (not implemented;
 * the smoke checklist in docs/launch-checklist-2026-09-07.md does
 * the equivalent checks manually).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'salon-poke-by-viva',
    version: process.env.npm_package_version || 'unknown',
    ts: new Date().toISOString(),
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
