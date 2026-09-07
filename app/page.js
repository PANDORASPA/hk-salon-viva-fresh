import Link from 'next/link'
import { getServerClient } from '../lib/supabase/server'
import { defaultServices, salonDefaults } from '../content/salon-poke-defaults'
import Footer from './components/Footer'
import Nav from './components/i18n/Nav'
import BrandIcon, { iconForCategory } from './components/BrandIcons'
import { t } from '../lib/i18n/dict'
import { getLocale } from '../lib/i18n/server'

export const metadata = {
  title: 'SALON POKE BY VIVA | 爆毛術脫髮護理',
  description: '超過20年專業經驗，專精頭髮修護、染髮、電髮及脫髮護理。亞洲人髮絲專家，香港市中心工作室。',
}

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const locale = getLocale()
  const db = await getServerClient()
  const [{ data: services }, { data: siteContent }] = await Promise.all([
    db.from('services').select('*').eq('published', true).eq('enabled', true).order('sort_order'),
    db.from('site_content').select('data').limit(1).maybeSingle(),
  ])

  const content = siteContent?.data || {}
  const id = content.identity || {}
  const c = salonDefaults

  const svcList = services?.length ? services : defaultServices.map(s => ({
    ...s,
    price: s.pricePence,
    duration_minutes: s.durationMinutes,
    category: s.category,
  }))

  const whatsapp = id.whatsapp || c.contact.whatsapp
  const waLink = `https://wa.me/${whatsapp}`

  return (
    <div className="salon">
      <Nav locale={locale} />

      <section className="salon-hero">
        <div className="salon-wrap">
          <p className="salon-eyebrow">{id.eyebrow || t('common.eyebrow', locale)}</p>
          <span className="salon-hero-divider" aria-hidden="true" />
          <h1>{id.heroTitle || t('home.stats.specialty.value', locale)}</h1>
          <p className="salon-hero-body">
            {id.heroBody || (locale === 'en'
              ? 'Over 20 years of expertise in cutting, colouring, perming, and hair regrowth. Asian hair specialists at our private Hong Kong studio.'
              : c.identity.heroBody)}
          </p>
          <div className="salon-hero-actions">
            <Link className="salon-button" href="/booking">{t('home.cta.book', locale)}</Link>
            <a className="salon-button salon-button-secondary" href={waLink} target="_blank" rel="noopener">
              {t('home.cta.whatsapp', locale)}
            </a>
          </div>
        </div>
      </section>

      <section className="salon-wrap salon-section">
        <div className="salon-stats">
          <div className="stat"><strong>{t('home.stats.experience.value', locale)}</strong><span>{t('home.stats.experience.label', locale)}</span></div>
          <div className="stat"><strong>{t('home.stats.specialty.value', locale)}</strong><span>{t('home.stats.specialty.label', locale)}</span></div>
          <div className="stat"><strong>{t('home.stats.location.value', locale)}</strong><span>{t('home.stats.location.label', locale)}</span></div>
        </div>
      </section>

      <section className="salon-wrap salon-section">
        <h2 className="salon-section-title">{t('home.services.title', locale)}</h2>
        <div className="salon-services">
          {svcList.map(s => {
            const icon = iconForCategory(s.category)
            return (
              <div key={s.id || s.name} className="salon-service-card">
                <div className="salon-service-icon" aria-hidden="true">
                  <BrandIcon name={icon} size={22} />
                </div>
                {s.category ? <span className="salon-service-cat">{s.category}</span> : null}
                <h3>{s.name}</h3>
                <p className="salon-service-desc">{s.description}</p>
                <div className="salon-service-meta">
                  <p className="salon-service-price">HK${((s.price || 0) / 100).toFixed(0)}</p>
                  <p className="salon-service-dur">{s.duration_minutes || s.durationMinutes}{t('common.minutes', locale) || ' 分鐘'}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link className="salon-button" href="/services">{t('home.services.viewAll', locale)}</Link>
        </div>
      </section>

      <section className="salon-wrap salon-section">
        <h2 className="salon-section-title">{t('home.treatment.title', locale)}</h2>
        <div className="salon-about-split">
          <div>
            <p>
              {locale === 'en'
                ? 'Our signature program is a deep-care plan designed for hair loss. We use professional techniques and quality products tailored for Asian hair, activating dormant follicles and supporting healthy growth.'
                : '爆毛術是我們的核心療程，專為脫髮問題而設的深層護理方案。採用專業技術及優質產品，針對亞洲人髮質特性，激活毛囊，促進健康生長。'}
            </p>
            <ul className="salon-bullet-list">
              {[0, 1, 2, 3].map((i) => (
                <li key={i}>
                  <BrandIcon name="leaf" size={18} className="salon-bullet-icon" />
                  <span>{t(`home.treatment.bullets.${i}`, locale)}</span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 24 }}>
              <a className="salon-button" href={waLink} target="_blank" rel="noopener">
                {t('home.treatment.cta', locale)}
              </a>
            </div>
          </div>
          <div className="salon-about-image-placeholder">
            <div className="salon-about-image-inner">
              <BrandIcon name="leaf" size={64} className="salon-about-image-icon" />
              <p style={{ color: '#928a81', textAlign: 'center', marginTop: 12 }}>
                {locale === 'en' ? 'Treatment illustration' : '爆毛術示意圖'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
