import { expect, test } from '@playwright/test'

const namespace = process.env.E2E_NAMESPACE || 'e2e_booking_platform'
const serviceName = `${namespace} 創意剪髮`
const adminEmail = process.env.E2E_ADMIN_EMAIL || `${namespace}.admin@example.test`
const password = process.env.E2E_TEST_PASSWORD || ''
const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function requiredEnvironment() {
  const missing = ['E2E_BASE_URL', 'E2E_SUPABASE_URL', 'E2E_SUPABASE_SERVICE_ROLE_KEY', 'E2E_DATABASE_MARKER', 'E2E_TEST_PASSWORD']
    .filter((name) => !process.env[name])
  if (missing.length) throw new Error(`E2E environment is not configured: ${missing.join(', ')}. Refusing to run without dedicated test credentials and database marker.`)
}

function targetDate() {
  const date = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

test.beforeEach(() => requiredEnvironment())

test('admin schedule change removes a staff member from public availability', async ({ page }) => {
  const date = targetDate()
  const weekday = weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()]
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(adminEmail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin/)
  await page.getByRole('button', { name: /員工及排班/ }).click()
  await page.getByRole('button', { name: `${namespace} 員工 A` }).click()
  const workday = page.getByLabel(`${weekday} 上班`)
  await expect(workday).toBeChecked()
  await workday.uncheck()
  await page.getByRole('button', { name: '儲存工時' }).click()
  await expect(page.getByText('已儲存每週工時。')).toBeVisible()

  await page.goto('/booking')
  await page.getByRole('radio', { name: serviceName }).check()
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('radio', { name: `${namespace} 員工 A` }).check()
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByLabel('日期').fill(date)
  await expect(page.getByText('當日無可預約時段，請選擇其他日期。')).toBeVisible()
  await expect(page.getByRole('radio', { name: /^\d{2}:\d{2}$/ })).toHaveCount(0)
})
