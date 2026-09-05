import './globals.css'

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

export default function RootLayout({ children }) {
  return (
    <html lang="zh-HK">
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
