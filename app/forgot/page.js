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
      <main className="present-f018ab06">
        <div className="present-3d5f0783">
          <h1 className="present-7d896692">
            {t('forgot.title', locale)}
          </h1>
          <p className="present-e9b345fd">
            {t('forgot.subtitle', locale)}
          </p>
          <div className="present-73c97001">
            <Suspense fallback={<p>{t('common.loading', locale)}</p>}>
              <ForgotForm locale={locale} />
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
