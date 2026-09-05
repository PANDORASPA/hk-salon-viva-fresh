import Link from 'next/link'

export const metadata = { title: '註冊 | SALON POKE BY VIVA' }

export default function SignupPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <h1 style={{ font: '600 32px/1.1 Georgia,serif', marginBottom: 16 }}>顧客註冊</h1>
        <p style={{ color: '#706961', marginBottom: 32 }}>我們的系統無需註冊即可預約。<br />直接在 <Link href="/booking" style={{ color: '#a98152' }}>預約頁面</Link> 填寫資料即可。</p>
        <Link href="/" style={{ color: '#a98152', fontSize: 14 }}>返回主頁</Link>
      </div>
    </div>
  )
}
