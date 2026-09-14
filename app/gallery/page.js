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
        <h1 className="present-54753b1b">
          {t('gallery.title', locale)}
        </h1>
        <p className="present-66a96bd6">{t('gallery.subtitle', locale)}</p>
        <div className="present-c01a1ea6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="present-a8a231e1">
              <BrandIcon name="leaf" size={28} className="" />
              <p className="present-89e04330">
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
