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
      <main className="salon-wrap salon-section present-f5551d8b" >
        <h1 className="present-d649b676">
          {t('privacy.title', locale)}
        </h1>
        <p className="present-140362e7">{t('privacy.updated', locale)}</p>
        <p className="present-4fb54260">{t('privacy.intro', locale)}</p>
        {sections.map((s) => (
          <div key={s} className="present-fec3619e">
            <h2 className="present-3cf419c7">{t(`privacy.sections.${s}.title`, locale)}</h2>
            <p className="present-ed996511">{t(`privacy.sections.${s}.body`, locale)}</p>
          </div>
        ))}
      </main>
      <Footer />
    </div>
  )
}
