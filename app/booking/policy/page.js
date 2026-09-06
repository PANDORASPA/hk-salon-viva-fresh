import Link from 'next/link'
import Footer from '../../components/Footer'

export const metadata = { title: '預約政策 | SALON POKE BY VIVA' }

export default function BookingPolicyPage() {
  const sections = [
    {
      icon: '📅',
      title: '預約流程',
      items: [
        '所有服務敬請提前預約，恕不接受即場 walk-in。',
        '你可通過本網站的預約表單、或直接聯絡我們預約。',
        '預約提交後，我們會透過 WhatsApp 確認你的預約時間及工作室地址。',
        '收到確認訊息後，預約方為正式生效。',
      ],
    },
    {
      icon: '🔄',
      title: '更改預約',
      items: [
        '如需更改預約時間，請最少 24 小時前通知。',
        '你可透過 WhatsApp 或致電聯絡我們更改。',
        '更改預約以當時的檔期而定，不保證原有時段。',
      ],
    },
    {
      icon: '❌',
      title: '取消預約',
      items: [
        '如需取消預約，請最少 24 小時前通知。',
        '24 小時內取消，或未如期到訪，我們保留收取服務費用的權利。',
        '連續兩次無故缺席，你將被列入關注名單，之後的預約可能需要預付按金。',
        '取消預約可通過本網站的「我的帳戶」頁面，或直接 WhatsApp 聯絡我們。',
      ],
    },
    {
      icon: '⏰',
      title: '準時到訪',
      items: [
        '請準時到達工作室，以便我們順利安排服務。',
        '遲到 15 分鐘以內：我們會盡量配合，但服務時間可能相應縮短。',
        '遲到超過 30 分鐘：我們可能需要重新安排你的預約，並保留收取部分費用的權利。',
        '如預計會遲到，請第一時間通知我們。',
      ],
    },
    {
      icon: '🎫',
      title: '套票政策',
      items: [
        '套票有效期由購買日起計算，期滿後未使用之次數恕不退款或延期。',
        '套票不可轉讓他人使用。',
        '如對套票使用有任何疑問，歡迎隨時聯絡我們。',
      ],
    },
    {
      icon: '💳',
      title: '付款方式',
      items: [
        '服務費用請於到店時以現金或轉帳方式支付。',
        '套票可於網上選購，我們會提供 FPS 轉帳指示。',
        '我們接受 FPS 轉數快付款。',
      ],
    },
    {
      icon: '🔒',
      title: '私隱及資料',
      items: [
        '我們妥善保管你的個人資料，僅用於預約聯絡用途。',
        '你不會收到任何未經同意的推廣訊息。',
        '如對你的個人資料處理有任何疑問，請聯絡我們。',
      ],
    },
  ]

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
        <h1 style={{ font: '700 42px/1.1 Georgia,serif', marginBottom: 12 }}>預約政策</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 40, fontSize: 16 }}>
          請在預約前仔細閱讀以下政策，感謝你的理解與配合。
        </p>

        <div style={{ display: 'grid', gap: 24, maxWidth: 720 }}>
          {sections.map(section => (
            <div key={section.title} style={{ background: 'var(--cream)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>{section.icon}</span>
                <h2 style={{ font: '600 20px/1.2 Georgia,serif', margin: 0 }}>{section.title}</h2>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text)' }}>
                {section.items.map((item, i) => (
                  <li key={i} style={{ marginBottom: 8, lineHeight: 1.6, color: '#4a4541' }}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, padding: 28, background: 'var(--gold-pale)', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--gold-light)', textAlign: 'center', maxWidth: 720 }}>
          <h3 style={{ font: '600 20px/1.2 Georgia,serif', margin: '0 0 12px' }}>有任何疑問？</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            歡迎透過 WhatsApp 或電郵與我們聯絡，我們樂意解答你的問題。
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/booking" className="salon-button">立即預約</Link>
            <Link href="/contact" className="salon-button" style={{ background: 'var(--gold-dark)' }}>聯絡我們</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
