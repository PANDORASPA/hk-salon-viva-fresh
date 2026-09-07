import { Suspense } from 'react'
import Link from 'next/link'
import AuthForm from '../components/AuthForm'
import SignInHelp from './SignInHelp'

export const metadata = { title: '登入 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default function SigninPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <h1 style={{ fontWeight: 600, fontSize: 32, lineHeight: 1.1, fontFamily: 'Georgia,serif', textAlign: 'center', marginBottom: 8 }}>
          顧客登入
        </h1>
        <p style={{ textAlign: 'center', color: '#706961', marginBottom: 24 }}>
          登入後可查看預約、套票餘額同改期。
        </p>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 28 }}>
          <Suspense fallback={<p>載入中…</p>}>
            <AuthForm mode="signin" />
          </Suspense>
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 14, color: '#706961' }}>
            仲未係會員？ <Link href="/signup" style={{ color: '#a98152' }}>建立帳戶</Link>
          </div>
        </div>
        <p style={{ textAlign: 'center', color: '#928a81', fontSize: 13, marginTop: 24 }}>
          唔想註冊？<Link href="/booking" style={{ color: '#a98152' }}>直接填表預約</Link> 即可，無需登入。
        </p>
        <p style={{ textAlign: 'center', marginTop: 12 }}>
          <Link href="/admin/login" style={{ color: '#706961', fontSize: 13 }}>管理員入口</Link>
        </p>
        <Suspense fallback={null}>
          <SignInHelp />
        </Suspense>
      </div>
    </div>
  )
}
