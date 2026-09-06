import Link from 'next/link'
import { getPublicSalonContent } from '../../lib/content/public-content'
import Footer from '../components/Footer'

export const dynamic = 'force-dynamic'
export const metadata = { title: '服務項目 | SALON POKE BY VIVA' }

export default async function ServicesPage() {
  const content = await getPublicSalonContent()
  const services = content.services || []
  const whatsapp = content.contact?.whatsapp || '852XXXXXXXX'
  const waLink = `https://wa.me/${whatsapp}`

  return (
    <div className="salon">
      <header className="salon-nav">
        <div className="salon-wrap">
          <nav>
            <Link href="/">主頁</Link>
            <Link href="/services">服務</Link>
            <Link href="/booking">預約</Link>
            <Link href="/gallery">圖庫</Link>
            <Link href="/about">關於</Link>
            <Link href="/contact">聯絡</Link>
          </nav>
        </div>
      </header>
      <main className="salon-wrap salon-section">
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 8 }}>服務項目</h1>
        <p style={{ color: '#706961', marginBottom: 40 }}>所有服務敬請預約，預約確認後我們會發送詳細地址。</p>
        {services.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#b0a493' }}>
            <p>服務項目即將更新，請稍候。</p>
          </div>
        ) : (
          <div className="salon-services">
            {services.map(s => (
              <div key={s.id} className="salon-service-card">
                <span className="salon-service-cat">{s.category}</span>
                <h3>{s.name}</h3>
                <p className="salon-service-desc">{s.description}</p>
                <p className="salon-service-price">HK${((s.pricePence || 0) / 100).toFixed(0)}</p>
                <p className="salon-service-dur">{s.durationMinutes}分鐘</p>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <a className="salon-button" href={waLink} target="_blank" rel="noopener">WhatsApp 查詢及預約</a>
        </div>
      </main>
      <Footer />
    </div>
  )
}
