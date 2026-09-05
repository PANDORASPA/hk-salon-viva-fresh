import Link from 'next/link'
import Footer from '../components/Footer'

export const metadata = { title: '關於我們 | SALON POKE BY VIVA' }

export default function AboutPage() {
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
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 24 }}>關於我們</h1>
        <p style={{ fontSize: 18, color: '#4a4541', maxWidth: 680, marginBottom: 32 }}>
          SALON POKE BY VIVA 成立於香港，專注為每一位客人提供專業、貼心的頭髮護理服務。超過20年累積的經驗，令我們對亞洲人髮質有深入了解，能夠提供最適合的造型及修護方案。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginBottom: 40 }}>
          {[
            ['20+ 年經驗', '專業髮型師團隊'],
            ['亞洲髮質專家', '了解你的髮絲'],
            ['爆毛術技術', '脫髮護理核心'],
            ['香港市中心', '便利預約位置'],
          ].map(([t, d]) => (
            <div key={t} style={{ padding: 24, background: '#f7f3ec', borderRadius: 8, borderTop: '3px solid #a98152' }}>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>{t}</h3>
              <p style={{ color: '#706961', margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: 32, background: '#f7f3ec', borderRadius: 8 }}>
          <h2 style={{ fontFamily: 'Georgia,serif', margin: '0 0 16px' }}>爆毛術 — 我們的核心技術</h2>
          <p style={{ color: '#4a4541', marginBottom: 16 }}>
            爆毛術是我們針對脫髮問題研發的專業護理療程，結合深層清潔、營養導入及毛囊激活技術，配合個人化的後續跟進，幫助客人重獲健康濃密的頭髮。
          </p>
          <Link className="salon-button" href="/booking">立即預約評估</Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
