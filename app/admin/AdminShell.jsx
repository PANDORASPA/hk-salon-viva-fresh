'use client'
import Link from 'next/link'
import { useState } from 'react'
import { getBrowserClient } from '../../lib/supabase/browser'
import {
  GalleryModule,
  ScheduleModule,
} from './components/OperationsSupportModules'
import CustomersModule from './components/CustomersModule'
import ServicesModule from './components/ServicesModule'
import PackagesModule from './components/PackagesModule'
import SettingsModule from './components/SettingsModule'
import SiteContentModule from './components/SiteContentModule'
import AdministratorsModule from './components/AdministratorsModule'
import AuditLogModule from './components/AuditLogModule'
import AdminNav from './components/AdminNav'
import BookingCalendar from './components/BookingCalendar'
import DashboardModule from './components/DashboardModule'
import StaffModule from './components/StaffModule'

const tabs = [
  ['dashboard', '營運總覽'],
  ['appointments', '預約日曆'],
  ['staff', '員工及排班'],
  ['customers', '客戶'],
  ['packages', '套票'],
  ['services', '服務定價'],
  ['settings', '設定'],
  ['schedule', '營業時間'],
  ['gallery', '圖庫'],
  ['site-content', '網站內容'],
  ['administrators', '管理員'],
  ['audit-log', '審計日誌'],
]

const panels = {
  dashboard: DashboardModule,
  appointments: BookingCalendar,
  staff: StaffModule,
  customers: CustomersModule,
  packages: PackagesModule,
  services: ServicesModule,
  settings: SettingsModule,
  schedule: ScheduleModule,
  gallery: GalleryModule,
  'site-content': SiteContentModule,
  administrators: AdministratorsModule,
  'audit-log': AuditLogModule,
}

export default function AdminShell({ email }) {
  const [active, setActive] = useState('dashboard')
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
        <aside><AdminNav tabs={tabs} active={active} onChange={setActive} /></aside>
        <section><Panel /></section>
      </div>
    </div>
  )
}
