import Link from 'next/link'
import { getPublicSalonContent } from '../../lib/content/public-content'
import ContactForm from '../components/ContactForm'
import Footer from '../components/Footer'

export const dynamic = 'force-dynamic'
export const metadata = { title: '聯絡我們 | SALON POKE BY VIVA' }

export default async function ContactPage() {
  const content = await getPublicSalonContent()
  const whatsapp = content.contact?.whatsapp || '852XXXXXXXX'
  const email = content.contact?.email || 'info@salonpokeviva.com'
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
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 32 }}>聯絡我們</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>📍</p>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>香港</h3>
            <p style={{ color: '#706961' }}>預約確認後發送確實地址</p>
          </div>
          <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>📱</p>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>WhatsApp</h3>
            <a href={waLink} target="_blank" rel="noopener" className="salon-button">{whatsapp}</a>
          </div>
          <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>✉️</p>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>電郵</h3>
            <a href={`mailto:${email}`} className="salon-button">{email}</a>
          </div>
          <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>⏰</p>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>營業時間</h3>
            <p style={{ color: '#706961' }}>星期一至六 10:00–19:00<br />星期日及公眾假期休息</p>
          </div>
        </div>

        {/* Contact Form */}
        <div style={{ marginTop: 48 }}>
          <h2 style={{ font: '600 28px/1.1 Georgia,serif', marginBottom: 20 }}>傳送訊息</h2>
          <ContactForm whatsapp={whatsapp} />
        </div>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <a className="salon-button" href={waLink} target="_blank" rel="noopener">WhatsApp 即時查詢</a>
        </div>
      </main>
      <Footer />
    </div>
  )
}
