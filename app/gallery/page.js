import Link from 'next/link'
import Footer from '../components/Footer'

export const metadata = { title: '圖庫 | SALON POKE BY VIVA' }

export default function GalleryPage() {
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
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 8 }}>圖庫</h1>
        <p style={{ color: '#706961', marginBottom: 40 }}>我們的作品，展示不同造型及護理效果。</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ background: '#ede6d9', borderRadius: 8, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#b0a493', fontSize: 14 }}>圖庫圖片 {i + 1}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
