import Link from 'next/link'
import Footer from '../components/Footer'

export const metadata = { title: '服務項目 | SALON POKE BY VIVA' }

const services = [
  { name: '創意剪髮', price: 'HK$480', dur: 60, cat: '剪髮', desc: '個人化剪裁造型，根據面型及風格打造完美髮型。' },
  { name: '深層護理', price: 'HK$280', dur: 45, cat: '護理', desc: '深層滋潤受損髮質，修復乾枯毛躁，令秀髮回復柔順光澤。' },
  { name: '電髮（離子燙/數碼燙）', price: 'HK$680', dur: 120, cat: '電髮', desc: '持久離子燙或數碼燙，由專業髮型師根據髮質建議最佳方案。' },
  { name: '染髮（全染/漂染）', price: 'HK$580', dur: 90, cat: '染髮', desc: '採用優質染劑，顏色持久自然，減少對髮絲的傷害。' },
  { name: '爆毛術增髮護理', price: 'HK$880', dur: 90, cat: '增髮', desc: '專為脫髮問題而設的深層護理，激活毛囊，促進健康生長。' },
  { name: '脫髮評估', price: 'HK$180', dur: 30, cat: '諮詢', desc: '專業脫髮情況評估及建議，了解你的專屬護理方案。' },
]

export default function ServicesPage() {
  const whatsapp = '852XXXXXXXX'
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
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 8 }}>服務項目</h1>
        <p style={{ color: '#706961', marginBottom: 40 }}>所有服務敬請預約，預約確認後我們會發送詳細地址。</p>
        <div className="salon-services">
          {services.map(s => (
            <div key={s.name} className="salon-service-card">
              <span className="salon-service-cat">{s.cat}</span>
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
