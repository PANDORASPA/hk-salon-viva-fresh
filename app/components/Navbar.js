'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const links = [
  ['/', '主頁'], ['/services', '服務'], ['/packages', '套票'], ['/booking', '預約'], ['/gallery', '圖庫'],
  ['/about', '關於'], ['/location', '地址'], ['/contact', '聯絡'],
]

export default function Navbar({ salon }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const active = (href) => pathname === href || (href !== '/' && pathname?.startsWith(`${href}/`))

  return (
    <header className="salon-header">
      <Link href="/" className="salon-brand" onClick={() => setOpen(false)}>
        <strong>{salon.identity.shortName}</strong><span>{salon.identity.tagline}</span>
      </Link>
      <button className="salon-menu-button" type="button" aria-expanded={open} aria-controls="salon-nav" onClick={() => setOpen(!open)}>
        <span className="sr-only">Menu</span>☰
      </button>
      <nav id="salon-nav" className={open ? 'salon-nav open' : 'salon-nav'} aria-label="Primary navigation">
        {links.map(([href, label]) => <Link key={href} href={href} className={active(href) ? 'active' : ''} onClick={() => setOpen(false)}>{label}</Link>)}
        <Link href="/account" onClick={() => setOpen(false)}>我的帳戶</Link>
        <Link href="/booking" className="salon-pill" onClick={() => setOpen(false)}>立即預約</Link>
      </nav>
    </header>
  )
}
