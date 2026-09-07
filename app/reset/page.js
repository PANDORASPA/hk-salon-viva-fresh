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
      <main style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h1 style={{ fontWeight: 600, fontSize: 32, lineHeight: 1.1, fontFamily: 'Georgia,serif', textAlign: 'center', marginBottom: 8 }}>
            {t('reset.title', locale)}
          </h1>
          <p style={{ textAlign: 'center', color: '#706961', marginBottom: 24 }}>
            {t('reset.subtitle', locale)}
          </p>
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 28 }}>
            <Suspense fallback={<p>{t('common.loading', locale)}</p>}>
              <ResetForm locale={locale} emailHint={user.email} />
            </Suspense>
          </div>
          <p style={{ textAlign: 'center', marginTop: 24 }}>
            <Link href="/signin" style={{ color: '#a98152', fontSize: 14 }}>
              ← {t('forgot.back', locale)}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
