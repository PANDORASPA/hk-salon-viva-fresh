'use client'
import { useCallback, useEffect, useState } from 'react'

export async function adminApi(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || '暫時未能完成，請重試。')
  return payload
}

export function useAdminRows(path, key) {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { setRows((await adminApi(path))[key] || []) } catch (cause) { setError(cause.message) } finally { setLoading(false) } }, [path, key])
  useEffect(() => { load() }, [load])
  return { rows, setRows, loading, error, load }
}

export function Module({ title, intro, children }) { return <div className="admin-module"><header><h2>{title}</h2>{intro ? <p>{intro}</p> : null}</header>{children}</div> }
export function Status({ loading, error, children }) { return loading ? <p role="status">載入中…</p> : error ? <p role="alert" className="salon-error">{error} <button type="button" onClick={children?.props?.onRetry}>重試</button></p> : children }
export function SaveButton({ pending, children = '儲存', ...props }) { return <button className="admin-action" disabled={pending || props.disabled} {...props}>{pending ? '儲存中…' : children}</button> }
export function Feedback({ error, success }) { return <>{error ? <p role="alert" className="salon-error">{error}</p> : null}{success ? <p role="status">{success}</p> : null}</> }
export function useSave() { const [pending, setPending] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); return { pending, error, success, async submit(work, message = '已儲存。') { setPending(true); setError(''); setSuccess(''); try { await work(); setSuccess(message); return true } catch (cause) { setError(cause.message); return false } finally { setPending(false) } } } }
