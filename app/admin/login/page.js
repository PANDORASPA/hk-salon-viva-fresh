import { Suspense } from 'react'
import Link from 'next/link'
import AuthForm from '../../components/AuthForm'
import SignInHelp from '../../signin/SignInHelp'

export const metadata = { title: '管理員登入 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default function AdminLoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <p style={{ textAlign: 'center', color: '#a98152', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          SALON POKE BY VIVA
        </p>
        <h1 style={{ fontWeight: 600, fontSize: 32, lineHeight: 1.1, fontFamily: 'Georgia,serif', textAlign: 'center', marginBottom: 8 }}>
          管理員登入
        </h1>
        <p style={{ textAlign: 'center', color: '#706961', marginBottom: 24 }}>
          只有 <code>admin_users</code> 內被標記為 <code>is_active</code> 嘅帳戶可以進入。
        </p>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 28 }}>
          <Suspense fallback={<p>載入中…</p>}>
            <AuthForm mode="signin" admin />
          </Suspense>
        </div>
        <p style={{ textAlign: 'center', marginTop: 24 }}>
          <Link href="/" style={{ color: '#706961', fontSize: 13 }}>← 返回主頁</Link>
        </p>
        <Suspense fallback={null}>
          <SignInHelp />
        </Suspense>
      </div>
    </div>
  )
}
