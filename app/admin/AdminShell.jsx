'use client'
import Link from 'next/link'
import { useState } from 'react'
import { getBrowserClient } from '../../lib/supabase/browser'
import { AdministratorsModule, AppointmentsModule, GalleryModule, ScheduleModule, ServicesModule, SiteContentModule } from '../components/admin/SalonAdminModules'
import { CustomersModule, PackagesModule } from '../components/admin/SalonCustomerModules'

const tabs = [
  ['appointments', '預約'],
  ['customers', '客戶'],
  ['packages', '套票'],
  ['services', '服務定價'],
  ['schedule', '營業時間'],
  ['gallery', '圖庫'],
  ['site-content', '網站內容'],
  ['administrators', '管理員'],
]

const panels = {
  appointments: AppointmentsModule,
  customers: CustomersModule,
  packages: PackagesModule,
  services: ServicesModule,
  schedule: ScheduleModule,
  gallery: GalleryModule,
  'site-content': SiteContentModule,
  administrators: AdministratorsModule,
}

export default function AdminShell({ email }) {
  const [active, setActive] = useState('appointments')
  const Panel = panels[active]
  const signOut = async () => {
    await getBrowserClient().auth.signOut()
    location.assign('/admin/login')
  }
  return (
    <div className="salon-admin">
      <header>
        <div>
          <small>SALON POKE BY VIVA</small>
          <h1>管理後台</h1>
        </div>
        <div>
          <span>{email}</span>
          <Link href="/">查看網站</Link>
          <button onClick={signOut}>登出</button>
        </div>
      </header>
      <div className="salon-admin-workspace">
        <aside>
          {tabs.map(([id, label]) => (
            <button className={active === id ? 'active' : ''} key={id} onClick={() => setActive(id)}>{label}</button>
          ))}
        </aside>
        <section><Panel /></section>
      </div>
    </div>
  )
}
