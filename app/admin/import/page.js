'use client'
import { useState } from 'react'
import { getBrowserClient } from '../../../lib/supabase/browser'

// This page requires an admin session; the route handler verifies the
// cookie and the proxy.js middleware ensures the user is logged in. Mark
// dynamic so the page is server-rendered per request rather than
// attempted at build time.
export const dynamic = 'force-dynamic'

const KIND_TO_ENDPOINT = {
  customers: '/api/admin/customers/import',
  services: '/api/admin/services/import',
}

const SAMPLES = {
  customers: `name,phone,email,notes
Ada Wong,91234567,ada@example.com,VIP
"Lee, Bob",98765432,,Referral friend
陳大文,91234568,,
`,
  services: `name,price,duration_minutes,category,description,sort_order,published
爆毛術護理,88000,90,爆毛,深層激活毛囊,1,true
深層護理,28000,45,護理,深層滋潤受損髮質,2,true
創意剪髮,48000,60,剪髮,個人化剪裁,3,true
`,
}

export default function CsvImportPage() {
  const [kind, setKind] = useState('customers')
  const [csv, setCsv] = useState(SAMPLES.customers)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onFile = async (event) => {
    const f = event.target.files?.[0]
    if (!f) return
    const text = await f.text()
    setCsv(text)
  }

  const submit = async (dryRun) => {
    setError('')
    setResult(null)
    setBusy(true)
    try {
      // We need the user-scoped Supabase auth to be passed through for
      // the admin route's adminContext() check. The route uses
      // getServerClient which reads cookies; from the browser we just POST
      // JSON and the cookie travels with the request.
      const r = await fetch(KIND_TO_ENDPOINT[kind], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dryRun }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error || 'Import failed.')
        if (d.errors) setResult({ errors: d.errors })
        return
      }
      setResult(d)
    } catch (e) {
      setError(e?.message || 'Network error.')
    } finally {
      setBusy(false)
    }
  }

  const switchKind = (next) => {
    setKind(next)
    setCsv(SAMPLES[next])
    setResult(null)
    setError('')
  }

  return (
    <div className="salon">
      <header className="salon-nav">
        <div className="salon-wrap">
          <nav>
            <a href="/admin" style={{ color: '#a98152', fontWeight: 600 }}>← 返回後台</a>
            <a href="/" style={{ color: '#706961' }}>查看網站</a>
          </nav>
        </div>
      </header>
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 36 }}>CSV 匯入</h1>
        <p style={{ color: '#706961', marginBottom: 24 }}>
          上傳 CSV 嚟批量加入客戶或服務。建議先用「試跑」驗證，再按「正式匯入」寫入。
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className="admin-action"
            style={kind === 'customers' ? { background: 'var(--gold)', color: '#fff' } : {}}
            onClick={() => switchKind('customers')}
          >
            客戶
          </button>
          <button
            type="button"
            className="admin-action"
            style={kind === 'services' ? { background: 'var(--gold)', color: '#fff' } : {}}
            onClick={() => switchKind('services')}
          >
            服務
          </button>
        </div>

        <div className="admin-module">
          <header>
            <h2>{kind === 'customers' ? '客戶 CSV' : '服務 CSV'}</h2>
            <p>
              {kind === 'customers'
                ? '必填欄位：name, phone ｜ 選填：email, notes。電話重複會覆蓋現有客戶。'
                : '必填欄位：name, price, duration_minutes ｜ 選填：category, description, sort_order, published。name 重複會覆蓋。'}
            </p>
          </header>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <label className="admin-action" style={{ cursor: 'pointer' }}>
              📁 選擇 CSV 檔案
              <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
            </label>
            <button type="button" className="admin-action" disabled={busy} onClick={() => submit(true)}>
              {busy ? '處理中…' : '試跑（不寫入）'}
            </button>
            <button type="button" className="admin-action" disabled={busy} onClick={() => submit(false)} style={{ background: 'var(--gold)', color: '#fff' }}>
              正式匯入
            </button>
          </div>

          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            style={{
              width: '100%',
              minHeight: 220,
              fontFamily: 'monospace',
              fontSize: 13,
              padding: 12,
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          />

          {error && (
            <div className="form-error" style={{ marginTop: 12 }}>⚠️ {error}</div>
          )}

          {result && (
            <div style={{ marginTop: 12, padding: 16, background: '#f7f3ec', borderRadius: 8 }}>
              {result.dryRun && (
                <p style={{ marginBottom: 8 }}>
                  ✅ 試跑結果：總共 {result.totalRows} 行，<strong>將處理 {result.wouldInsertOrUpdate || result.uniqueByPhone || result.uniqueByName}</strong> 個唯一項目。
                </p>
              )}
              {!result.dryRun && (
                <p style={{ marginBottom: 8 }}>
                  ✅ 匯入完成：<strong>{result.inserted ?? 0}</strong> 新增，<strong>{result.updated ?? 0}</strong> 更新，{result.failed ?? 0} 失敗。
                </p>
              )}
              {result.errors?.length > 0 && (
                <details>
                  <summary style={{ cursor: 'pointer', color: '#c0392b' }}>
                    {result.errors.length} 個驗證錯誤
                  </summary>
                  <pre style={{ marginTop: 8, fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                    {JSON.stringify(result.errors, null, 2)}
                  </pre>
                </details>
              )}
              {result.failures?.length > 0 && (
                <details>
                  <summary style={{ cursor: 'pointer', color: '#c0392b' }}>
                    {result.failures.length} 個寫入失敗
                  </summary>
                  <pre style={{ marginTop: 8, fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                    {JSON.stringify(result.failures, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
