import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="salon-footer">
      <div className="salon-wrap">
        <div className="salon-footer-grid">
          <div>
            <p className="salon-footer-brand">SALON POKE BY VIVA</p>
            <p className="salon-footer-tagline">爆毛術脫髮護理 — 亞洲人髮絲專家</p>
          </div>
          <div>
            <p className="salon-footer-heading">快捷連結</p>
            <nav>
              <Link href="/">主頁</Link>
              <Link href="/services">服務</Link>
              <Link href="/booking">預約</Link>
              <Link href="/about">關於</Link>
              <Link href="/contact">聯絡</Link>
            </nav>
          </div>
          <div>
            <p className="salon-footer-heading">資訊</p>
            <nav>
              <Link href="/terms">使用條款</Link>
              <Link href="/privacy">隱私政策</Link>
            </nav>
          </div>
        </div>
        <p className="salon-footer-copy">© {new Date().getFullYear()} SALON POKE BY VIVA. 保留所有權利。</p>
      </div>
    </footer>
  )
}
