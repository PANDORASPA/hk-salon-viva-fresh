'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const links = [
  ['/', 'Home'], ['/services', 'Services'], ['/booking', 'Booking'], ['/gallery', 'Gallery'],
  ['/about', 'About'], ['/location', 'Location'], ['/contact', 'Contact'],
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
        <Link href="/signin" onClick={() => setOpen(false)}>Sign in</Link>
        <Link href="/booking" className="salon-pill" onClick={() => setOpen(false)}>Book Now</Link>
      </nav>
    </header>
  )
}
