import { Suspense } from 'react'
import Link from 'next/link'
import { getServerClient } from '../../lib/supabase/server'
import { redirect } from 'next/navigation'
import ResetForm from './ResetForm'
import Nav from '../components/i18n/Nav'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'

export const metadata = { title: '重設密碼 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default async function ResetPage() {
  const locale = getLocale()
  // The user lands here from /auth/callback after a recovery link click.
  // The session is now active. If there is no user, bounce to /forgot
  // so the page is never publicly accessible without an in-flight
  // password reset.
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/forgot')

  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="present-f018ab06">
        <div className="present-3d5f0783">
          <h1 className="present-7d896692">
            {t('reset.title', locale)}
          </h1>
          <p className="present-e9b345fd">
            {t('reset.subtitle', locale)}
          </p>
          <div className="present-73c97001">
            <Suspense fallback={<p>{t('common.loading', locale)}</p>}>
              <ResetForm locale={locale} emailHint={user.email} />
            </Suspense>
          </div>
          <p className="present-729fe37b">
            <Link href="/signin" className="present-78539e49">
              ← {t('forgot.back', locale)}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
