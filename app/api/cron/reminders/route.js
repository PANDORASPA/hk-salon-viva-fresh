import { NextResponse } from 'next/server'
import { getServiceClient } from '../../../../lib/supabase/service'
import { sendEmail } from '../../../../lib/notifications/email.js'
import { dispatchReminders } from '../../../../lib/notifications/reminders.js'
import { readAppSettings } from '../../../../lib/settings/app-settings'

/**
 * Vercel invokes this endpoint hourly. Its existing query-secret contract is
 * retained, while PostgreSQL atomically claims every reminder before delivery.
 */
export async function GET(request) {
  const secret = new URL(request.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET not configured on server.' }, { status: 500 })
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let db
  try { db = getServiceClient() } catch { return NextResponse.json({ error: 'Supabase service role not configured.' }, { status: 500 }) }
  try {
    const settings = await readAppSettings(db)
    return NextResponse.json(await dispatchReminders({ db, settings, sendEmail }))
  } catch {
    return NextResponse.json({ error: 'Unable to process reminders.' }, { status: 500 })
  }
}
