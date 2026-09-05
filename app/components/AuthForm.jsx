'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { getBrowserClient } from '../../lib/supabase/browser'

export default function AuthForm({ mode = 'signin', admin = false }) {
  const router = useRouter(), search = useSearchParams(), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget), email = String(form.get('email')).trim().toLowerCase(), password = String(form.get('password'))
    const supabase = getBrowserClient()
    const result = mode === 'signup' ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password })
    if (result.error) { setError(result.error.message); setBusy(false); return }
    if (admin) {
      const { data } = await supabase.from('admin_users').select('is_active').eq('user_id', result.data.user.id).maybeSingle()
      if (!data?.is_active) { await supabase.auth.signOut(); setError('This account does not have administrator access.'); setBusy(false); return }
    }
    if (mode === 'signup' && !result.data.session) { router.push('/signin?created=1'); return }
    const requested = search.get('redirectTo') || (admin ? '/admin' : '/account')
    router.push(requested.startsWith('/') && !requested.startsWith('//') ? requested : (admin ? '/admin' : '/account')); router.refresh()
  }
  return <form className="salon-form auth-form" onSubmit={submit}><label>Email<input type="email" name="email" autoComplete="email" required /></label><label>Password<input type="password" name="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength="8" required /></label>{error ? <p role="alert" className="salon-error">{error}</p> : null}<button className="salon-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>{!admin ? <p>{mode === 'signup' ? <>Already registered? <Link href="/signin">Sign in</Link></> : <>New here? <Link href="/signup">Create an account</Link></>}</p> : null}</form>
}
