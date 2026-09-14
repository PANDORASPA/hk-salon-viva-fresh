import { Suspense } from 'react'
import Link from 'next/link'
import AuthForm from '../../components/AuthForm'
import SignInHelp from '../../signin/SignInHelp'

export const metadata = { title: '管理員登入 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default function AdminLoginPage() {
  return (
    <div className="present-41f27ca6">
      <div className="present-3d5f0783">
        <p className="present-ad5e699d">
          SALON POKE BY VIVA
        </p>
        <h1 className="present-7d896692">
          管理員登入
        </h1>
        <p className="present-e9b345fd">
          只有 <code>admin_users</code> 內被標記為 <code>is_active</code> 嘅帳戶可以進入。
        </p>
        <div className="present-73c97001">
          <Suspense fallback={<p>載入中…</p>}>
            <AuthForm mode="signin" admin />
          </Suspense>
        </div>
        <p className="present-729fe37b">
          <Link href="/" className="present-9200fedf">← 返回主頁</Link>
        </p>
        <Suspense fallback={null}>
          <SignInHelp />
        </Suspense>
      </div>
    </div>
  )
}
