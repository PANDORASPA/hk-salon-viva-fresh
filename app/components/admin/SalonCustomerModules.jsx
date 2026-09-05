'use client'
import { useCallback, useEffect, useState } from 'react'

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Request failed.')
  return payload
}

const useResource = (path, key) => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setRows((await api(path))[key] || []) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [path, key])
  useEffect(() => { load() }, [load])
  return { rows, setRows, loading, error, load }
}

const State = ({ loading, error, children }) =>
  loading ? <p>Loading…</p> : error ? <p role="alert" className="salon-error">{error}</p> : children

const Btn = ({ children, ...p }) => <button className="admin-action" {...p}>{children}</button>

function Module({ title, intro, children }) {
  return (
    <div className="admin-module">
      <header><h2>{title}</h2>{intro ? <p>{intro}</p> : null}</header>
      {children}
    </div>
  )
}

function balanceColor(remaining, total) {
  if (!total) return '#928a81'
  const ratio = remaining / total
  if (ratio === 0) return '#c0392b'
  if (ratio <= 0.25) return '#e67e22'
  return '#27ae60'
}

// ── Customers ──────────────────────────────────────────────
export function CustomersModule() {
  const r = useResource('/api/admin/customers', 'customers')
  const [detail, setDetail] = useState(null)
  const [pkgForm, setPkgForm] = useState({ customer_id: '', package_id: '', total_sessions: '' })
  const [pkgOptions, setPkgOptions] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', email: '', notes: '' })
  const [packages, setPackages] = useState([])

  useEffect(() => {
    fetch('/api/admin/packages').then(x => x.json()).then(x => setPackages(x.packages || []))
  }, [])

  const loadDetail = async (id) => {
    try {
      const d = await api(`/api/admin/customers/${id}`)
      setDetail(d.customer)
      setPkgForm(c => ({ ...c, customer_id: id }))
    } catch (e) { alert(e.message) }
  }

  const saveCustomer = async (e) => {
    e.preventDefault()
    try {
      await api('/api/admin/customers', { method: 'POST', body: JSON.stringify(addForm) })
      setAddForm({ name: '', phone: '', email: '', notes: '' })
      setShowAdd(false)
      r.load()
    } catch (e) { alert(e.message) }
  }

  const assignPackage = async (e) => {
    e.preventDefault()
    try {
      await api('/api/admin/customer-packages', {
        method: 'POST',
        body: JSON.stringify({ ...pkgForm, total_sessions: Number(pkgForm.total_sessions) }),
      })
      setPkgForm({ ...pkgForm, package_id: '', total_sessions: '' })
      loadDetail(pkgForm.customer_id)
    } catch (e) { alert(e.message) }
  }

  return (
    <Module title="客戶記錄" intro="管理客戶資料及套票分配。">
      <Btn onClick={() => setShowAdd(s => !s)}>{showAdd ? '取消新增' : '+ 新增客戶'}</Btn>
      {showAdd && (
        <form className="admin-inline-form" onSubmit={saveCustomer} style={{ marginTop: 12 }}>
          <input placeholder="姓名" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required />
          <input placeholder="電話" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} required />
          <input placeholder="電郵（選填）" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
          <input placeholder="備註（選填）" value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
          <Btn type="submit">儲存</Btn>
        </form>
      )}
      <State {...r}>
        <div className="admin-list">
          {r.rows.map(c => (
            <article key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <p>{c.phone} {c.email || ''}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {c.customer_packages?.length > 0 && (
                  <span style={{ fontSize: 11, color: '#928a81' }}>
                    {c.customer_packages.length} 個套票
                  </span>
                )}
                <Btn onClick={() => loadDetail(c.id)}>詳情</Btn>
              </div>
            </article>
          ))}
        </div>
      </State>

      {detail && (
        <div style={{ marginTop: 24, padding: 20, border: '1px solid #ded5c8', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 16px' }}>客戶詳情：{detail.name}</h3>
          <p style={{ margin: '0 0 12px', color: '#706961' }}>電話：{detail.phone} | 電郵：{detail.email || '—'}</p>

          <h4 style={{ margin: '16px 0 8px' }}>套票記錄</h4>
          {detail.customer_packages?.length > 0 ? detail.customer_packages.map(cp => (
            <div key={cp.id} style={{ padding: '8px 12px', marginBottom: 8, background: '#f7f3ec', borderLeft: `4px solid ${cp.packages?.colour_hex || '#a98152'}`, borderRadius: 4 }}>
              <strong>{cp.packages?.name}</strong>
              <span style={{ marginLeft: 12, color: balanceColor(cp.sessions_remaining, cp.total_sessions), fontWeight: 600 }}>
                {cp.sessions_remaining} / {cp.total_sessions} 次
              </span>
              {!cp.is_active && <span style={{ marginLeft: 8, color: '#c0392b', fontSize: 12 }}>（已停用）</span>}
            </div>
          )) : <p style={{ color: '#928a81' }}>暫無套票</p>}

          <h4 style={{ margin: '20px 0 8px' }}>分配套票</h4>
          <form className="admin-inline-form" onSubmit={assignPackage}>
            <select value={pkgForm.package_id} onChange={e => setPkgForm(f => ({ ...f, package_id: e.target.value }))} required>
              <option value="">選擇套票…</option>
              {packages.map(p => <option key={p.id} value={p.id}>{p.name}（{p.total_sessions}次）</option>)}
            </select>
            <input type="number" min="1" placeholder="次數" value={pkgForm.total_sessions} onChange={e => setPkgForm(f => ({ ...f, total_sessions: e.target.value }))} required />
            <Btn type="submit">分配</Btn>
          </form>
          <Btn onClick={() => setDetail(null)} style={{ marginTop: 12 }}>關閉</Btn>
        </div>
      )}
    </Module>
  )
}

// ── Packages ────────────────────────────────────────────────
export function PackagesModule() {
  const r = useResource('/api/admin/packages', 'packages')
  const [services, setServices] = useState([])
  const [draft, setDraft] = useState({ name: '', colour_hex: '#a98152', description: '', total_sessions: 10, validity_days: 365, price_hkd: 0 })
  const [editing, setEditing] = useState(null)
  const [linkPkg, setLinkPkg] = useState(null)

  useEffect(() => {
    fetch('/api/admin/services').then(x => x.json()).then(x => setServices(x.services || []))
  }, [])

  const save = async (e) => {
    e.preventDefault()
    const method = editing ? 'PATCH' : 'POST'
    const url = editing ? `/api/admin/packages/${editing}` : '/api/admin/packages'
    await api(url, { method, body: JSON.stringify(editing ? { ...draft, id: editing } : draft) })
    setDraft({ name: '', colour_hex: '#a98152', description: '', total_sessions: 10, validity_days: 365, price_hkd: 0 })
    setEditing(null)
    r.load()
  }

  const edit = (pkg) => {
    setEditing(pkg.id)
    setDraft({ name: pkg.name, colour_hex: pkg.colour_hex || '#a98152', description: pkg.description || '', total_sessions: pkg.total_sessions, validity_days: pkg.validity_days, price_hkd: pkg.price_hkd })
  }

  const linkSvc = async (pkgId, svcId) => {
    await api('/api/admin/packages/services', { method: 'POST', body: JSON.stringify({ package_id: pkgId, service_id: Number(svcId) }) })
    r.load()
  }

  const unlinkSvc = async (pkgId, svcId) => {
    await api(`/api/admin/packages/services?package_id=${pkgId}&service_id=${svcId}`, { method: 'DELETE' })
    r.load()
  }

  return (
    <Module title="套票管理" intro="建立套票並關聯可用的服務項目。">
      <form className="admin-inline-form" onSubmit={save} style={{ flexWrap: 'wrap', gap: 8 }}>
        <input placeholder="套票名稱" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} required style={{ width: 140 }} />
        <input type="color" value={draft.colour_hex} onChange={e => setDraft(d => ({ ...d, colour_hex: e.target.value }))} style={{ width: 44, height: 36, padding: 2 }} />
        <input type="number" min="1" placeholder="次數" value={draft.total_sessions} onChange={e => setDraft(d => ({ ...d, total_sessions: Number(e.target.value) }))} style={{ width: 70 }} />
        <input type="number" min="0" placeholder="有效期（日）" value={draft.validity_days} onChange={e => setDraft(d => ({ ...d, validity_days: Number(e.target.value) }))} style={{ width: 100 }} />
        <input type="number" min="0" placeholder="HK$ 售價" value={draft.price_hkd} onChange={e => setDraft(d => ({ ...d, price_hkd: Number(e.target.value) }))} style={{ width: 90 }} />
        <input placeholder="描述（選填）" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} style={{ width: 160 }} />
        <Btn type="submit">{editing ? '儲存更改' : '+ 新增套票'}</Btn>
        {editing && <Btn type="button" onClick={() => { setEditing(null); setDraft({ name: '', colour_hex: '#a98152', description: '', total_sessions: 10, validity_days: 365, price_hkd: 0 }) }}>取消</Btn>}
      </form>
      <State {...r}>
        <div className="admin-list">
          {r.rows.map(pkg => (
            <article key={pkg.id} style={{ borderLeft: `4px solid ${pkg.colour_hex || '#a98152'}` }}>
              <div>
                <strong>{pkg.name}</strong>
                <p style={{ fontSize: 12, color: '#706961' }}>
                  {pkg.total_sessions}次 · {pkg.validity_days}日有效期 · HK${pkg.price_hkd} · {pkg.is_active ? '啟用' : '停用'}
                </p>
                <p style={{ fontSize: 12, color: '#928a81' }}>
                  包含服務：
                  {pkg.package_services?.map(ps => (
                    <span key={ps.service_id} style={{ marginRight: 6 }}>
                      {ps.services?.name}
                      <button onClick={() => unlinkSvc(pkg.id, ps.service_id)} style={{ marginLeft: 2, color: '#c0392b', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11 }}>×</button>
                    </span>
                  ))}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select onChange={e => { if (e.target.value) linkSvc(pkg.id, e.target.value); e.target.value = '' }} defaultValue="">
                  <option value="">+ 加入服務</option>
                  {services.filter(s => !pkg.package_services?.find(ps => ps.service_id === s.id)).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <Btn onClick={() => edit(pkg)}>編輯</Btn>
              </div>
            </article>
          ))}
        </div>
      </State>
    </Module>
  )
}
