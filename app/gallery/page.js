import Link from 'next/link'
import Footer from '../components/Footer'
import Nav from '../components/i18n/Nav'
import BrandIcon from '../components/BrandIcons'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'

export const metadata = { title: '圖庫 | SALON POKE BY VIVA' }

export const dynamic = 'force-dynamic'

export default function GalleryPage() {
  const locale = getLocale()
  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 8 }}>
          {t('gallery.title', locale)}
        </h1>
        <p style={{ color: '#706961', marginBottom: 40 }}>{t('gallery.subtitle', locale)}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ background: 'linear-gradient(135deg, #ede6d9 0%, #d9cdb6 100%)', borderRadius: 8, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#928a81' }}>
              <BrandIcon name="leaf" size={28} className="" />
              <p style={{ color: '#928a81', fontSize: 14, margin: 0 }}>
                {t('gallery.placeholder', locale).replace('{n}', String(i + 1))}
              </p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
