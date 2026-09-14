import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server.js'
import { getServiceClient } from '../../../../lib/supabase/service.js'
import { sendEmail } from '../../../../lib/notifications/email.js'
import { dispatchReminders } from '../../../../lib/notifications/reminders.js'
import { readAppSettings } from '../../../../lib/settings/app-settings.js'

/**
 * Vercel invokes this endpoint hourly. Its existing query-secret contract is
 * retained, while PostgreSQL atomically claims every reminder before delivery.
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured on server.' }, { status: 500 })
  if (!isAuthorizedCronRequest(request, secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let db
  try { db = getServiceClient() } catch { return NextResponse.json({ error: 'Supabase service role not configured.' }, { status: 500 }) }
  try {
    const settings = await readAppSettings(db)
    return NextResponse.json(await dispatchReminders({ db, settings, sendEmail }))
  } catch {
    return NextResponse.json({ error: 'Unable to process reminders.' }, { status: 500 })
  }
}

function sameSecret(candidate, secret) {
  if (typeof candidate !== 'string') return false
  const left = Buffer.from(candidate)
  const right = Buffer.from(secret)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function isAuthorizedCronRequest(request, secret) {
  const authorization = request.headers.get('authorization')
  if (authorization) return sameSecret(authorization.startsWith('Bearer ') ? authorization.slice(7) : '', secret)
  // Legacy query authorization is intentionally retained for existing Vercel
  // schedules. New schedules should use the official Authorization header.
  return sameSecret(new URL(request.url).searchParams.get('secret'), secret)
}

export const __testing = { isAuthorizedCronRequest, sameSecret }
