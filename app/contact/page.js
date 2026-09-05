import Footer from '../components/Footer'

export const metadata = { title: '聯絡我們 | SALON POKE BY VIVA' }

export default function ContactPage() {
  const whatsapp = '852XXXXXXXX'
  return (
    <div className="salon">
      <header className="salon-nav">
        <div className="salon-wrap">
          <nav>
            <a href="/">SALON POKE</a>
            <a href="/services">服務</a>
            <a href="/booking">預約</a>
            <a href="/gallery">圖庫</a>
            <a href="/about">關於</a>
            <a href="/contact">聯絡</a>
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
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener" className="salon-button">{whatsapp}</a>
          </div>
          <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>⏰</p>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>營業時間</h3>
            <p style={{ color: '#706961' }}>星期一至六 10:00–19:00<br />星期日及公眾假期休息</p>
          </div>
        </div>
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <a className="salon-button" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener">WhatsApp 即時查詢</a>
        </div>
      </main>
      <Footer />
    </div>
  )
}
