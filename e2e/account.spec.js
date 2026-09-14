import { expect, test } from '@playwright/test'

const namespace = process.env.E2E_NAMESPACE || 'e2e_booking_platform'
const serviceName = `${namespace} 創意剪髮`
const customerEmail = process.env.E2E_CUSTOMER_EMAIL || `${namespace}.customer@example.test`
const password = process.env.E2E_TEST_PASSWORD || ''

function requiredEnvironment() {
  const missing = ['E2E_BASE_URL', 'E2E_SUPABASE_URL', 'E2E_SUPABASE_SERVICE_ROLE_KEY', 'E2E_DATABASE_MARKER', 'E2E_TEST_PASSWORD']
    .filter((name) => !process.env[name])
  if (missing.length) throw new Error(`E2E environment is not configured: ${missing.join(', ')}. Refusing to run without dedicated test credentials and database marker.`)
}

function hongKongDate(daysAhead = 7) {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

async function signIn(page) {
  await page.goto('/signin?redirectTo=/booking')
  await page.getByLabel('Email').fill(customerEmail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/booking/)
}

test.beforeEach(() => requiredEnvironment())

test('authenticated package booking is refunded after customer cancellation', async ({ page }) => {
  await signIn(page)
  await page.getByRole('radio', { name: serviceName }).check()
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('radio', { name: '任何可服務員工' }).check()
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByLabel('日期').fill(hongKongDate(7))
  await expect(page.getByText('請選擇可預約時段。')).toBeVisible()
  await page.getByRole('radio', { name: /^\d{2}:\d{2}$/ }).first().check()
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByLabel('姓名').fill(`${namespace} customer`)
  await page.getByLabel('電話').fill('61234560')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('radio', { name: new RegExp(`${namespace} 套票`) }).check()
  await page.getByRole('checkbox', { name: '我已核對預約資料，並同意預約安排。' }).check()
  await page.getByRole('button', { name: '確認預約' }).click()
  await expect(page).toHaveURL(/\/booking\/confirm\?id=/)
  await page.goto('/account')
  const booking = page.locator('article').filter({ hasText: serviceName })
  await expect(booking).toContainText('已扣減')
  page.once('dialog', (dialog) => dialog.accept())
  await booking.getByRole('button', { name: '取消' }).click()
  await expect(page.getByRole('status')).toContainText('套票次數已退還')
  await expect(booking).toContainText('已退還')
  const sessions = await page.evaluate(() => fetch('/api/customers/me').then((response) => response.json()))
  expect(sessions.customer.customer_packages.find((item) => item.packages.name.includes('套票')).sessions_remaining).toBe(2)
})
