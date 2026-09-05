import Link from 'next/link'
import Footer from '../components/Footer'

export const metadata = { title: '位置 | SALON POKE BY VIVA' }

export default function LocationPage() {
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
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 24 }}>位置</h1>
        <div style={{ padding: 32, background: '#f7f3ec', borderRadius: 8, marginBottom: 24 }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>📍 香港</p>
          <p style={{ color: '#706961' }}>預約確認後，我們會通過 WhatsApp 發送確實工作室地址。</p>
        </div>
        <div style={{ padding: 32, background: '#f7f3ec', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>交通</h3>
          <ul style={{ color: '#706961', paddingLeft: 20 }}>
            <li>港鐵直達，步行數分鐘</li>
            <li>周邊有公眾停車場</li>
          </ul>
        </div>
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link className="salon-button" href="/booking">立即預約</Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
