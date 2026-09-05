import Link from 'next/link'
import Footer from '../components/Footer'

export const metadata = { title: '使用條款 | SALON POKE BY VIVA' }

export default function TermsPage() {
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
        <h1 style={{ font: '600 36px/1.1 Georgia,serif', marginBottom: 24 }}>使用條款</h1>
        <p style={{ color: '#706961', marginBottom: 24, fontSize: 14 }}>最後更新：2024年1月</p>
        {[
          ['預約', '所有服務敬請提前預約。預約確認後，我們會發送 WhatsApp 訊息確認時間及地址。'],
          ['取消政策', '如需取消或更改預約，請最少 24 小時前通知。24 小時內取消可能收取服務費用。'],
          ['遲到', '遲到超過 30 分鐘，我們可能需要縮短服務時間或重新安排預約。'],
          ['套票', '套票有效期由購買日起計算，逾期未使用的次數將不予退款或延期。'],
          ['付款', '服務費用於到店時支付。我們接受現金及轉帳。'],
          ['私隱', '我們會妥善保管你的個人資料，僅用於預約及服務聯絡用途。'],
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
