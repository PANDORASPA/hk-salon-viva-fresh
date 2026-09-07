import Link from 'next/link'
import Nav from './components/i18n/Nav'
import { t } from '../lib/i18n/dict.js'
import { getLocale } from '../lib/i18n/server-helper.js'

// Server-rendered 404. Reads the locale once and renders a bilingual
// shell. Keeps the same brand bar / nav as the rest of the site so
// the user does not feel stranded.
export const metadata = { title: '找不到頁面 | SALON POKE BY VIVA' }

export default async function NotFound() {
  const locale = await getLocale()
  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section" style={{ textAlign: 'center', paddingTop: 80, paddingBottom: 80 }}>
        <p style={{ color: '#a98152', letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 12, marginBottom: 12 }}>
          404
        </p>
        <h1 className="salon-section-title" style={{ marginBottom: 12, fontSize: 36 }}>
          {locale === 'en' ? 'Page not found' : '找不到頁面'}
        </h1>
        <p style={{ color: '#706961', marginBottom: 32 }}>
          {locale === 'en'
            ? 'The page you are looking for has been moved, deleted, or never existed.'
            : '你想搵嘅頁面可能已經搬咗、刪咗、或者從來都冇。'}
        </p>
        <div style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link className="salon-button" href="/">{t('nav.home', locale)}</Link>
          <Link className="salon-button salon-button-secondary" href="/booking">{t('nav.booking', locale)}</Link>
          <Link className="salon-button salon-button-secondary" href="/services">{t('nav.services', locale)}</Link>
        </div>
      </main>
    </div>
  )
}
