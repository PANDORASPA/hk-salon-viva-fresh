import { Suspense } from 'react'
import Link from 'next/link'
import AuthForm from '../components/AuthForm'
import SignInHelp from '../signin/SignInHelp'

export const metadata = { title: '建立帳戶 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default function SignupPage() {
  return (
    <div className="present-41f27ca6">
      <div className="present-3d5f0783">
        <h1 className="present-7d896692">
          建立帳戶
        </h1>
        <p className="present-e9b345fd">
          用 email 同密碼開個帳戶，方便日後查看預約同套票。
        </p>
        <div className="present-73c97001">
          <Suspense fallback={<p>載入中…</p>}>
            <AuthForm mode="signup" />
          </Suspense>
          <div className="present-52eba926">
            已經有帳戶？ <Link href="/signin" className="present-154eba31">登入</Link>
          </div>
        </div>
        <p className="present-e3703928">
          唔想註冊？<Link href="/booking" className="present-154eba31">直接填表預約</Link> 即可，無需登入。
        </p>
        <Suspense fallback={null}>
          <SignInHelp />
        </Suspense>
      </div>
    </div>
  )
}
