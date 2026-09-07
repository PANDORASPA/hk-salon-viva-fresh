import { Suspense } from 'react'
import Link from 'next/link'
import AuthForm from '../components/AuthForm'
import SignInHelp from '../signin/SignInHelp'

export const metadata = { title: '建立帳戶 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default function SignupPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <h1 style={{ fontWeight: 600, fontSize: 32, lineHeight: 1.1, fontFamily: 'Georgia,serif', textAlign: 'center', marginBottom: 8 }}>
          建立帳戶
        </h1>
        <p style={{ textAlign: 'center', color: '#706961', marginBottom: 24 }}>
          用 email 同密碼開個帳戶，方便日後查看預約同套票。
        </p>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 28 }}>
          <Suspense fallback={<p>載入中…</p>}>
            <AuthForm mode="signup" />
          </Suspense>
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 14, color: '#706961' }}>
            已經有帳戶？ <Link href="/signin" style={{ color: '#a98152' }}>登入</Link>
          </div>
        </div>
        <p style={{ textAlign: 'center', color: '#928a81', fontSize: 13, marginTop: 24 }}>
          唔想註冊？<Link href="/booking" style={{ color: '#a98152' }}>直接填表預約</Link> 即可，無需登入。
        </p>
        <Suspense fallback={null}>
          <SignInHelp />
        </Suspense>
      </div>
    </div>
  )
}
