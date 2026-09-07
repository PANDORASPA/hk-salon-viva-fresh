'use client'

import { useSearchParams } from 'next/navigation'

/**
 * Reads `?message=...` and `?created=1` from the URL and shows the
 * matching notice above the form. Helps the user understand why they
 * were sent back to the sign-in page (e.g. confirmation email not
 * confirmed, or session expired).
 */
export default function SignInHelp() {
  const params = useSearchParams()
  const message = params.get('message')
  const created = params.get('created') === '1'
  const redirectTo = params.get('redirectTo')

  if (message === 'confirm_failed') {
    return (
      <p role="alert" className="salon-error" style={{ marginTop: 16, textAlign: 'center' }}>
        ⚠️ 確認連結已過期或無效。請重新註冊。
      </p>
    )
  }
  if (message === 'session_expired') {
    return (
      <p role="alert" className="salon-error" style={{ marginTop: 16, textAlign: 'center' }}>
        ⚠️ 登入已過期，請重新登入。
        {redirectTo && <small style={{ display: 'block', marginTop: 4 }}>返回：{redirectTo}</small>}
      </p>
    )
  }
  if (message === 'denied') {
    return (
      <p role="alert" className="salon-error" style={{ marginTop: 16, textAlign: 'center' }}>
        ⚠️ 此帳戶無管理員權限。
      </p>
    )
  }
  if (created) {
    return (
      <p role="status" className="form-success" style={{ marginTop: 16, textAlign: 'center' }}>
        ✓ 帳戶已建立。請檢查電郵確認連結，再返嚟登入。
      </p>
    )
  }
  return null
}
