import Link from 'next/link'
import Footer from '../components/Footer'
import { defaultServices, salonDefaults } from '../../content/salon-poke-defaults'
import { getServerClient } from '../../lib/supabase/server'

export const metadata = { title: '服務項目 | SALON POKE BY VIVA' }

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
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
    // env not configured — fall back to in-code defaults
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
      <header className="salon-nav">
        <div className="salon-wrap">
          <nav>
            <Link href="/">SALON POKE</Link>
            <Link href="/services">服務</Link>
            <Link href="/booking">預約</Link>
            <Link href="/gallery">圖庫</Link>
            <Link href="/about">關於</Link>
            <Link href="/contact">聯絡</Link>
          </nav>
        </div>
      </header>
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 42 }}>服務項目</h1>
        <p style={{ color: '#706961', marginBottom: 40 }}>所有服務敬請預約，預約確認後我們會發送詳細地址。</p>
        <div className="salon-services">
          {services.map(s => (
            <div key={s.name} className="salon-service-card">
              {s.cat && <span className="salon-service-cat">{s.cat}</span>}
              <h3>{s.name}</h3>
              <p className="salon-service-desc">{s.desc}</p>
              <p className="salon-service-price">{s.price}</p>
              <p className="salon-service-dur">{s.dur}分鐘</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <a className="salon-button" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener">WhatsApp 查詢及預約</a>
        </div>
      </main>
      <Footer />
    </div>
  )
}
