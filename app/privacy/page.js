import Footer from '../components/Footer'
import Nav from '../components/i18n/Nav'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'

export const metadata = { title: '隱私政策 | SALON POKE BY VIVA' }

export const dynamic = 'force-dynamic'

export default function PrivacyPage() {
  const locale = getLocale()
  const sections = ['collection', 'usage', 'storage', 'rights']
  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section" style={{ maxWidth: 720 }}>
        <h1 style={{ font: '600 36px/1.1 Georgia,serif', marginBottom: 24 }}>
          {t('privacy.title', locale)}
        </h1>
        <p style={{ color: '#706961', marginBottom: 24, fontSize: 14 }}>{t('privacy.updated', locale)}</p>
        <p style={{ color: '#4a4541', lineHeight: 1.7, marginBottom: 20 }}>{t('privacy.intro', locale)}</p>
        {sections.map((s) => (
          <div key={s} style={{ marginBottom: 24 }}>
            <h2 style={{ font: '600 18px/1.2 Georgia,serif', marginBottom: 8 }}>{t(`privacy.sections.${s}.title`, locale)}</h2>
            <p style={{ color: '#4a4541', lineHeight: 1.7 }}>{t(`privacy.sections.${s}.body`, locale)}</p>
          </div>
        ))}
      </main>
      <Footer />
    </div>
  )
}
