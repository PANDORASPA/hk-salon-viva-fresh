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
      <p role="status" className="form-success" style={{ textAlign: 'center' }}>
        {t('reset.success', locale)}
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      {error && (
        <p role="alert" className="salon-error" style={{ marginBottom: 12 }}>
          ⚠️ {error}
        </p>
      )}
      {emailHint && (
        <p style={{ fontSize: 13, color: '#706961', marginBottom: 12 }}>
          {locale === 'en' ? 'Signed in as ' : '目前帳戶：'}<strong>{emailHint}</strong>
        </p>
      )}
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label htmlFor="pw" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
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
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 15 }}
        />
      </div>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label htmlFor="pw2" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
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
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 15 }}
        />
      </div>
      <button
        type="submit"
        className="salon-button"
        disabled={busy}
        style={{ width: '100%', textAlign: 'center' }}
      >
        {busy ? t('common.loading', locale) : t('reset.cta', locale)}
      </button>
    </form>
  )
}
