import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '../../../lib/supabase/admin.js'

export const dynamic = 'force-dynamic'

export default async function RetiredImportPage() {
  const auth = await requireAdmin()
  if (auth.error) redirect('/admin/login')
  return <main className="salon-wrap salon-section">
    <h1>CSV 匯入已停用</h1>
    <p>舊有批量匯入功能未能保證每項更改與管理記錄一起儲存，因此已停用，並不會匯入或覆蓋任何資料。</p>
    <p>請在客戶記錄或服務管理逐項新增及編輯，系統會保留更改前後的管理記錄。</p>
    <Link className="admin-action" href="/admin">返回管理後台</Link>
  </main>
}
