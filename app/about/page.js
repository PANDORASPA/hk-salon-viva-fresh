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
        <h1 className="present-4f80823c">
          {t('about.title', locale)}
        </h1>
        <p className="present-4ba21e2d">
          {t('about.intro', locale)}
        </p>
        <div className="present-69cf5f48">
          {cards.map((c) => (
            <div key={c.title} className="present-339bfcea">
              <h3 className="present-9d645636">{c.title}</h3>
              <p className="present-64fbd8bc">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="present-9bf61411">
          <h2 className="present-30fca7a1">{t('about.treatment.title', locale)}</h2>
          <p className="present-a3136548">{t('about.treatment.body', locale)}</p>
          <Link className="salon-button" href="/booking">{t('about.treatment.cta', locale)}</Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
