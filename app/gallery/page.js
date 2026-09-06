import Link from 'next/link'
import { getPublicSalonContent } from '../../lib/content/public-content'
import Footer from '../components/Footer'

export const dynamic = 'force-dynamic'
export const metadata = { title: '圖庫 | SALON POKE BY VIVA' }

export default async function GalleryPage() {
  const content = await getPublicSalonContent()
  const images = content.gallery || []

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
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 8 }}>圖庫</h1>
        <p style={{ color: '#706961', marginBottom: 40 }}>我們的作品，展示不同造型及護理效果。</p>
        {images.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#b0a493' }}>
            <p style={{ fontSize: 16 }}>圖庫即將上線，請期待。</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {images.map((img) => (
              <div key={img.id} style={{ background: '#ede6d9', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.path} alt={img.alt || img.label || '圖庫圖片'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {img.label && (
                  <p style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 12px', background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 13, margin: 0 }}>{img.label}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
