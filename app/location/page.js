import Link from 'next/link'
import Footer from '../components/Footer'
import Nav from '../components/i18n/Nav'
import BrandIcon from '../components/BrandIcons'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'

export const metadata = { title: '位置 | SALON POKE BY VIVA' }

export const dynamic = 'force-dynamic'

export default function LocationPage() {
  const locale = getLocale()
  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 24 }}>
          {t('location.title', locale)}
        </h1>
        <div style={{ padding: 32, background: '#f7f3ec', borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'var(--gold)' }}><BrandIcon name="leaf" size={28} /></span>
          <div>
            <p style={{ fontSize: 18, margin: '0 0 4px' }}>{t('location.addressLabel', locale)}</p>
            <p style={{ color: '#706961', margin: 0 }}>{t('location.addressNote', locale)}</p>
          </div>
        </div>
        <div style={{ padding: 32, background: '#f7f3ec', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>{t('location.transit.title', locale)}</h3>
          <ul style={{ color: '#706961', paddingLeft: 20, margin: 0 }}>
            {[0, 1].map((i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <BrandIcon name="arrow" size={14} className="salon-bullet-icon" />
                <span>{t(`location.transit.items.${i}`, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link className="salon-button" href="/booking">{t('location.cta', locale)}</Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
