import Link from 'next/link'
import { getServerClient } from './lib/supabase/server'
import { defaultServices } from './content/salon-poke-defaults'
import { salonDefaults } from './content/salon-poke-defaults'
import Footer from './components/Footer'
import './app/globals.css'

export const metadata = {
  title: 'SALON POKE BY VIVA | 爆毛術脫髮護理',
  description: '超過20年專業經驗，專精剪髮、染髮、電髮及頭髮修護。亞洲人髮絲專家，香港市中心工作室。',
}

export default async function HomePage() {
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
      <header className="salon-nav">
        <div className="salon-wrap">
          <nav>
            <Link href="/">{c.identity.shortName}</Link>
            <Link href="/services">服務</Link>
            <Link href="/booking">預約</Link>
            <Link href="/gallery">圖庫</Link>
            <Link href="/about">關於</Link>
            <Link href="/contact">聯絡</Link>
          </nav>
        </div>
      </header>

      <section className="salon-hero">
        <div className="salon-wrap">
          <p className="salon-eyebrow">{id.eyebrow || c.identity.eyebrow}</p>
          <h1>{id.heroTitle || c.identity.heroTitle}</h1>
          <p className="salon-hero-body">{id.heroBody || c.identity.heroBody}</p>
          <div className="salon-hero-actions">
            <Link className="salon-button" href="/booking">立即預約</Link>
            <a className="salon-button salon-button-secondary" href={waLink} target="_blank" rel="noopener">WhatsApp 查詢</a>
          </div>
        </div>
      </section>

      <section className="salon-wrap salon-section">
        <div className="salon-stats">
          <div className="stat"><strong>20+</strong><span>年經驗</span></div>
          <div className="stat"><strong>亞洲</strong><span>髮質專家</span></div>
          <div className="stat"><strong>香港</strong><span>市中心</span></div>
        </div>
      </section>

      <section className="salon-wrap salon-section">
        <h2 className="salon-section-title">服務項目</h2>
        <div className="salon-services">
          {svcList.map(s => (
            <div key={s.id || s.name} className="salon-service-card">
              <h3>{s.name}</h3>
              <p className="salon-service-desc">{s.description}</p>
              <p className="salon-service-price">HK${((s.price || 0) / 100).toFixed(0)}</p>
              <p className="salon-service-dur">{s.duration_minutes || s.durationMinutes}分鐘</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link className="salon-button" href="/services">查看全部服務</Link>
        </div>
      </section>

      <section className="salon-wrap salon-section">
        <h2 className="salon-section-title">爆毛術護理</h2>
        <div className="salon-about-split">
          <div>
            <p>爆毛術是我們的核心療程，專為脫髮問題而設的深層護理方案。採用專業技術及優質產品，針對亞洲人髮質特性，激活毛囊，促進健康生長。</p>
            <ul style={{ marginTop: 16, paddingLeft: 20 }}>
              <li>專業脫髮評估及分析</li>
              <li>個人化護理方案</li>
              <li>深層清潔及滋養</li>
              <li>追蹤進度及調整</li>
            </ul>
            <div style={{ marginTop: 24 }}>
              <a className="salon-button" href={waLink} target="_blank" rel="noopener">查詢爆毛術療程</a>
            </div>
          </div>
          <div className="salon-about-image-placeholder">
            <p style={{ color: '#928a81', textAlign: 'center', paddingTop: 40 }}>爆毛術示意圖</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
