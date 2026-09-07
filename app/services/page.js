import Footer from '../components/Footer'
import { defaultServices, salonDefaults } from '../../content/salon-poke-defaults'
import { getServerClient } from '../../lib/supabase/server'
import Nav from '../components/i18n/Nav'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'

export const metadata = { title: '服務項目 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const locale = getLocale()
  let dbServices = []
  try {
    const db = await getServerClient()
    const { data } = await db
      .from('services')
      .select('id, name, price, duration_minutes, category, description')
      .eq('published', true).eq('enabled', true)
      .order('sort_order')
    dbServices = data || []
  } catch {
    // env not configured
  }
  const services = dbServices.length
    ? dbServices.map(s => ({
        name: s.name,
        price: `HK$${((s.price || 0) / 100).toFixed(0)}`,
        dur: s.duration_minutes,
        cat: s.category,
        desc: s.description || '',
      }))
    : defaultServices.map(s => ({
        name: s.name,
        price: `HK$${(s.pricePence / 100).toFixed(0)}`,
        dur: s.durationMinutes,
        cat: s.category,
        desc: s.description || '',
      }))

  const whatsapp = salonDefaults.contact.whatsapp

  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 42 }}>
          {t('services.title', locale)}
        </h1>
        <p style={{ color: '#706961', marginBottom: 40 }}>
          {t('services.subtitle', locale)}
        </p>
        <div className="salon-services">
          {services.map(s => (
            <div key={s.name} className="salon-service-card">
              {s.cat && <span className="salon-service-cat">{s.cat}</span>}
              <h3>{s.name}</h3>
              <p className="salon-service-desc">{s.desc}</p>
              <p className="salon-service-price">{s.price}</p>
              <p className="salon-service-dur">{s.dur}{t('common.minutes', locale)}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <a className="salon-button" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener">
            {t('services.cta', locale)}
          </a>
        </div>
      </main>
      <Footer />
    </div>
  )
}
