'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '../../lib/supabase/browser'
import { t } from '../../lib/i18n/dict'

export default function ResetForm({ locale = 'zh-HK', emailHint }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError(locale === 'en' ? 'Password must be at least 8 characters.' : '密碼最少 8 個字元。')
      return
    }
    if (password !== confirm) {
      setError(locale === 'en' ? 'Passwords do not match.' : '兩次輸入嘅密碼唔一致。')
      return
    }
    setBusy(true)
    try {
      const supabase = getBrowserClient()
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
        setBusy(false)
        return
      }
      setDone(true)
      // Brief pause so the success message is visible before redirect
      setTimeout(() => router.push('/signin?reset=1'), 1500)
    } catch (e) {
      setError(e?.message || 'Network error')
      setBusy(false)
    }
  }

  if (done) {
    return (
      <p role="status" className="form-success present-fb5ec070" >
        {t('reset.success', locale)}
      </p>
    )
  }

  return (
    <form method="post" action="/api/auth/unavailable" onSubmit={onSubmit}>
      {error && (
        <p role="alert" className="salon-error present-c804002a" >
          ⚠️ {error}
        </p>
      )}
      {emailHint && (
        <p className="present-8799bec9">
          {locale === 'en' ? 'Signed in as ' : '目前帳戶：'}<strong>{emailHint}</strong>
        </p>
      )}
      <div className="form-group present-c804002a" >
        <label htmlFor="pw" className="present-2ce7c8b9">
          {t('common.password', locale)} {t('common.required', locale)}
        </label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="present-1fd96f2f"
        />
      </div>
      <div className="form-group present-4933c088" >
        <label htmlFor="pw2" className="present-2ce7c8b9">
          {locale === 'en' ? 'Confirm password' : '確認密碼'} {t('common.required', locale)}
        </label>
        <input
          id="pw2"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="present-1fd96f2f"
        />
      </div>
      <button
        type="submit"
        className="salon-button present-cd00d17d"
        disabled={busy}

      >
        {busy ? t('common.loading', locale) : t('reset.cta', locale)}
      </button>
    </form>
  )
}
