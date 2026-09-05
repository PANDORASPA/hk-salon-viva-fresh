import Link from 'next/link'
import Footer from '../components/Footer'

export const metadata = { title: '隱私政策 | SALON POKE BY VIVA' }

export default function PrivacyPage() {
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
      <main className="salon-wrap salon-section" style={{ maxWidth: 720 }}>
        <h1 style={{ font: '600 36px/1.1 Georgia,serif', marginBottom: 24 }}>隱私政策</h1>
        <p style={{ color: '#706961', marginBottom: 24, fontSize: 14 }}>最後更新：2024年1月</p>
        <p style={{ color: '#4a4541', lineHeight: 1.7, marginBottom: 20 }}>
          SALON POKE BY VIVA（下稱「我們」）承諾保障你的私隱。本政策說明我們如何收集、使用及保護你所提供的個人資料。
        </p>
        {[
          ['收集的資料', '我們收集姓名、聯絡電話、電郵及預約記錄，以提供預約及服務跟進。'],
          ['資料用途', '你的資料僅用於預約確認、服務提醒及客戶服務聯絡，不會用於任何市場推廣或轉交第三方。'],
          ['資料儲存', '你的資料儲存於加密的雲端資料庫，並受密碼保護。'],
          ['你的權利', '你可隨時要求查閱、更正或刪除你的個人資料。請通過 WhatsApp 或電郵與我們聯絡。'],
        ].map(([h, b]) => (
          <div key={h} style={{ marginBottom: 24 }}>
            <h2 style={{ font: '600 18px/1.2 Georgia,serif', marginBottom: 8 }}>{h}</h2>
            <p style={{ color: '#4a4541', lineHeight: 1.7 }}>{b}</p>
          </div>
        ))}
      </main>
      <Footer />
    </div>
  )
}
