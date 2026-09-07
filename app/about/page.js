import Link from 'next/link'
import Footer from '../components/Footer'
import Nav from '../components/i18n/Nav'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'

export const metadata = { title: '關於我們 | SALON POKE BY VIVA' }

export const dynamic = 'force-dynamic'

export default function AboutPage() {
  const locale = getLocale()
  const cards = [0, 1, 2, 3].map((i) => ({
    title: t(`about.cards.${i}.title`, locale),
    body: t(`about.cards.${i}.body`, locale),
  }))

  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 24 }}>
          {t('about.title', locale)}
        </h1>
        <p style={{ fontSize: 18, color: '#4a4541', maxWidth: 680, marginBottom: 32 }}>
          {t('about.intro', locale)}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginBottom: 40 }}>
          {cards.map((c) => (
            <div key={c.title} style={{ padding: 24, background: '#f7f3ec', borderRadius: 8, borderTop: '3px solid #a98152' }}>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>{c.title}</h3>
              <p style={{ color: '#706961', margin: 0 }}>{c.body}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: 32, background: '#f7f3ec', borderRadius: 8 }}>
          <h2 style={{ fontFamily: 'Georgia,serif', margin: '0 0 16px' }}>{t('about.treatment.title', locale)}</h2>
          <p style={{ color: '#4a4541', marginBottom: 16 }}>{t('about.treatment.body', locale)}</p>
          <Link className="salon-button" href="/booking">{t('about.treatment.cta', locale)}</Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
