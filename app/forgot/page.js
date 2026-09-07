import { Suspense } from 'react'
import Link from 'next/link'
import ForgotForm from './ForgotForm'
import Nav from '../components/i18n/Nav'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'

export const metadata = { title: '忘記密碼 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default function ForgotPage() {
  const locale = getLocale()
  return (
    <div className="salon">
      <Nav locale={locale} />
      <main style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h1 style={{ fontWeight: 600, fontSize: 32, lineHeight: 1.1, fontFamily: 'Georgia,serif', textAlign: 'center', marginBottom: 8 }}>
            {t('forgot.title', locale)}
          </h1>
          <p style={{ textAlign: 'center', color: '#706961', marginBottom: 24 }}>
            {t('forgot.subtitle', locale)}
          </p>
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 28 }}>
            <Suspense fallback={<p>{t('common.loading', locale)}</p>}>
              <ForgotForm locale={locale} />
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
