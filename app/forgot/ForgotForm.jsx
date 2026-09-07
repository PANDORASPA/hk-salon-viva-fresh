'use client'

import { useState } from 'react'
import { getBrowserClient } from '../../lib/supabase/browser'
import { t } from '../../lib/i18n/dict'

/**
 * Sends the Supabase recovery email. Always shows a generic "if that
 * email exists, we sent a link" message regardless of whether the email
 * is actually registered — this avoids leaking which addresses have
 * accounts and matches the "we never tell anyone" pattern recommended
 * for auth UX.
 */
export default function ForgotForm({ locale = 'zh-HK' }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const supabase = getBrowserClient()
      const siteUrl = window.location.origin
      // The link in the recovery email points to /auth/callback with a
      // `next=/reset` param. The callback handler already redirects to
      // /reset after exchanging the code for a session.
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${siteUrl}/auth/callback?next=/reset`,
      })
      if (err) {
        // Rate-limit errors still don't reveal whether the email exists
        setError(err.message)
        setBusy(false)
        return
      }
      setDone(true)
    } catch (e) {
      setError(e?.message || 'Network error')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <p role="status" className="form-success" style={{ textAlign: 'center' }}>
        {t('forgot.sent', locale)}
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
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label htmlFor="email" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
          {t('common.email', locale)} {t('common.required', locale)}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 15 }}
        />
      </div>
      <button
        type="submit"
        className="salon-button"
        disabled={busy}
        style={{ width: '100%', textAlign: 'center' }}
      >
        {busy ? t('common.loading', locale) : t('forgot.cta', locale)}
      </button>
    </form>
  )
}
