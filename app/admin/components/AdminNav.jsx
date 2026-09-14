'use client'

export default function AdminNav({ tabs, active, onChange }) {
  return (
    <nav className="admin-nav" aria-label="管理後台功能">
      {tabs.map(([id, label]) => (
        <button key={id} type="button" className={active === id ? 'active' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </nav>
  )
}
