import Link from 'next/link'
import './signin.css'

export const metadata = { title: '登入 | SALON POKE BY VIVA' }

export default function SigninPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ font: '600 32px/1.1 Georgia,serif', textAlign: 'center', marginBottom: 8 }}>登入</h1>
        <p style={{ textAlign: 'center', color: '#706961', marginBottom: 32 }}>管理員專用</p>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 28 }}>
          <p style={{ fontSize: 14, color: '#706961', textAlign: 'center', marginBottom: 20 }}>
            請前往 <Link href="/admin/login" style={{ color: '#a98152' }}>管理員登入</Link> 頁面
          </p>
          <Link href="/" style={{ display: 'block', textAlign: 'center', color: '#a98152', fontSize: 14 }}>返回主頁</Link>
        </div>
      </div>
    </div>
  )
}
