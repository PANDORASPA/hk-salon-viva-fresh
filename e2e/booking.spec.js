import { expect, test } from '@playwright/test'

const namespace = process.env.E2E_NAMESPACE || 'e2e_booking_platform'
const serviceName = `${namespace} 創意剪髮`
const guestName = `${namespace} guest`

function requiredEnvironment() {
  const missing = ['E2E_BASE_URL', 'E2E_SUPABASE_URL', 'E2E_SUPABASE_SERVICE_ROLE_KEY', 'E2E_DATABASE_MARKER']
    .filter((name) => !process.env[name])
  if (missing.length) throw new Error(`E2E environment is not configured: ${missing.join(', ')}. Refusing to run without dedicated test credentials and database marker.`)
}

function hongKongDate(daysAhead = 7) {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

async function chooseBookableSlot(page, daysAhead = 7) {
  await page.getByLabel('日期').fill(hongKongDate(daysAhead))
  await expect(page.getByText('請選擇可預約時段。')).toBeVisible()
  const slot = page.getByRole('radio', { name: /^\d{2}:\d{2}$/ }).first()
  await expect(slot).toBeVisible()
  await slot.check()
}

async function completeGuestBooking(page) {
  await page.goto('/booking')
  await page.getByRole('radio', { name: serviceName }).check()
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('radio', { name: '任何可服務員工' }).check()
  await page.getByRole('button', { name: '下一步' }).click()
  await chooseBookableSlot(page)
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByLabel('姓名').fill(guestName)
  await page.getByLabel('電話').fill('61234567')
  await page.getByLabel('電郵（選填）').fill(`${namespace}.guest@example.test`)
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('checkbox', { name: '我已核對預約資料，並同意預約安排。' }).check()
}

test.beforeEach(() => requiredEnvironment())

test('guest self-pay booking assigns an available employee', async ({ page }) => {
  await completeGuestBooking(page)
  await page.getByRole('button', { name: '確認預約' }).click()
  await expect(page).toHaveURL(/\/booking\/confirm\?id=/)
  await expect(page.getByText('預約編號')).toBeVisible()
  await expect(page.getByText('服務員工')).toBeVisible()
  await expect(page.locator('article').filter({ hasText: '服務員工' }).getByText(/E2E/)).toBeVisible()
})

test('simultaneous overlapping guest bookings return one 201 and one 409', async ({ page }) => {
  await page.goto('/booking')
  const result = await page.evaluate(async ({ serviceName, namePrefix, date }) => {
    const services = await fetch('/api/services').then((response) => response.json())
    const service = services.services.find((row) => row.name === serviceName)
    if (!service) throw new Error(`Seeded service not found: ${serviceName}`)
    const staff = await fetch(`/api/staff?serviceId=${service.id}`).then((response) => response.json())
    const person = staff.staff.find((row) => row.displayName.includes('員工 A'))
    if (!person) throw new Error('Seeded staff member not found')
    const availability = await fetch(`/api/availability?date=${date}&serviceId=${service.id}&staffId=${person.id}`).then((response) => response.json())
    const slot = availability.slots?.[0]
    if (!slot) throw new Error(`No seeded slot for ${date}`)
    const book = (suffix) => fetch('/api/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: service.id, staffPreference: person.id, startsAt: slot.iso,
        customerName: `${namePrefix} concurrent ${suffix}`, customerPhone: suffix === 'A' ? '61234568' : '61234569',
        customerEmail: `${namePrefix}.${suffix.toLowerCase()}@example.test` }),
    }).then(async (response) => ({ status: response.status, body: await response.json() }))
    return Promise.all([book('A'), book('B')])
  }, { serviceName, namePrefix: namespace, date: hongKongDate(14) })
  expect(result.map((row) => row.status).sort()).toEqual([201, 409])
})
