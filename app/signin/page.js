import { Suspense } from 'react'
import Link from 'next/link'
import AuthForm from '../components/AuthForm'
import SignInHelp from './SignInHelp'

export const metadata = { title: '登入 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default function SigninPage() {
  return (
    <div className="present-41f27ca6">
      <div className="present-3d5f0783">
        <h1 className="present-7d896692">
          顧客登入
        </h1>
        <p className="present-e9b345fd">
          登入後可查看預約、套票餘額同改期。
        </p>
        <div className="present-73c97001">
          <Suspense fallback={<p>載入中…</p>}>
            <AuthForm mode="signin" />
          </Suspense>
          <div className="present-52eba926">
            <Link href="/forgot" className="present-154eba31">忘記密碼？</Link>
          </div>
          <div className="present-56058790">
            仲未係會員？ <Link href="/signup" className="present-154eba31">建立帳戶</Link>
          </div>
        </div>
        <p className="present-e3703928">
          唔想註冊？<Link href="/booking" className="present-154eba31">直接填表預約</Link> 即可，無需登入。
        </p>
        <p className="present-f4d857fe">
          <Link href="/admin/login" className="present-9200fedf">管理員入口</Link>
        </p>
        <Suspense fallback={null}>
          <SignInHelp />
        </Suspense>
      </div>
    </div>
  )
}
