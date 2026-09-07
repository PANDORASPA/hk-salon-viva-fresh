'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '../../../lib/supabase/browser'
import { t } from '../../../lib/i18n/dict'

/**
 * Lets a signed-in member update their profile. Writes directly to the
 * `profiles` table via the browser Supabase client (RLS restricts to
 * the row's own `id = auth.uid()`, so this is safe even without a
 * server round-trip).
 */
export default function ProfileForm({ initialProfile, initialEmail, locale = 'zh-HK' }) {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: initialProfile?.full_name || '',
    phone: initialProfile?.phone || '',
    notes: initialProfile?.notes || '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const supabase = getBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(locale === 'en' ? 'Not signed in.' : '未登入。')
      const { error: err } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
      if (err) throw err
      setSaved(true)
      router.refresh()
    } catch (e) {
      setError(e?.message || (locale === 'en' ? 'Save failed.' : '儲存失敗。'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
          {locale === 'en' ? 'Email' : '電郵'}
        </label>
        <input
          type="email"
          value={initialEmail || ''}
          disabled
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 15, background: '#f7f3ec', color: '#706961' }}
        />
        <small style={{ color: '#928a81', fontSize: 12 }}>
          {locale === 'en' ? 'Email cannot be changed in this build.' : '電郵暫時未可以改（聯絡我哋改）。'}
        </small>
      </div>

      <div className="form-group" style={{ marginBottom: 14 }}>
        <label htmlFor="fullName" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
          {locale === 'en' ? 'Full name' : '姓名'} {t('common.required', locale)}
        </label>
        <input
          id="fullName"
          type="text"
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 15 }}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 14 }}>
        <label htmlFor="phone" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
          {locale === 'en' ? 'Phone' : '電話'}
        </label>
        <input
          id="phone"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="9123 4567"
          autoComplete="tel"
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 15 }}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 18 }}>
        <label htmlFor="notes" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
          {locale === 'en' ? 'Notes (allergies, preferences)' : '備註（過敏、偏好）'}
        </label>
        <textarea
          id="notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          maxLength={2000}
          rows={3}
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 15, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </div>

      {error && (
        <p role="alert" className="salon-error" style={{ marginBottom: 12 }}>⚠️ {error}</p>
      )}
      {saved && (
        <p role="status" className="form-success" style={{ marginBottom: 12 }}>
          ✓ {locale === 'en' ? 'Saved.' : '已儲存。'}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="submit"
          className="salon-button"
          disabled={busy}
          style={{ textAlign: 'center' }}
        >
          {busy ? t('common.loading', locale) : (locale === 'en' ? 'Save changes' : '儲存')}
        </button>
        <button
          type="button"
          className="admin-action"
          onClick={() => router.push('/account')}
        >
          {locale === 'en' ? 'Cancel' : '取消'}
        </button>
      </div>
    </form>
  )
}
