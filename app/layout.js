import './globals.css'
import { cookies } from 'next/headers'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../lib/i18n/dict'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://salonpokeviva.com'

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'SALON POKE BY VIVA | 爆毛術脫髮護理', template: '%s | SALON POKE BY VIVA' },
  description: '超過20年專業經驗，專精剪髮、染髮、電髮及頭髮修護。亞洲人髮絲專家，香港市中心工作室。',
  keywords: ['爆毛術', '脫髮護理', '頭髮護理', '香港脫髮', 'SALON POKE BY VIVA'],
  openGraph: {
    type: 'website',
    locale: 'zh_HK',
    url: siteUrl,
    siteName: 'SALON POKE BY VIVA',
    title: 'SALON POKE BY VIVA | 爆毛術脫髮護理',
    description: '超過20年專業經驗，專精剪髮、染髮、電髮及頭髮修護。',
  },
}

export const viewport = { width: 'device-width', initialScale: 1 }

export const robots = {
  index: true,
  follow: true,
  nocache: false,
}

export default function RootLayout({ children }) {
  // Read the lang cookie so the <html lang> attribute matches the
  // active locale. Falls back to DEFAULT_LOCALE if missing/invalid.
  let lang = DEFAULT_LOCALE
  try {
    const c = cookies().get('lang')?.value
    if (c && SUPPORTED_LOCALES.includes(c)) lang = c
  } catch {
    // cookies() may throw outside a request context
  }
  return (
    <html lang={lang}>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
