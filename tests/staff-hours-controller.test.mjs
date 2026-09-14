import assert from 'node:assert/strict'
import test from 'node:test'

import { createStaffHoursController } from '../app/admin/components/staff-hours-controller.js'

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body })

const weeklyHours = () => Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  isWorking: weekday !== 0,
  startsAt: weekday === 0 ? null : '10:00',
  endsAt: weekday === 0 ? null : '19:00',
}))

test('staff hours controller lets an invalid draft be corrected and saved', async () => {
  // Mutation caught: a validation error must not leave the corrected draft
  // permanently disabled, as the old shared error flag did.
  const requests = []
  const controller = createStaffHoursController({
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, ...options })
      return options.method === 'PUT'
        ? jsonResponse({ hours: weeklyHours() })
        : jsonResponse({ hours: weeklyHours() })
    },
  })

  await controller.load(7)
  controller.update(1, { startsAt: '19:00' })
  await controller.save(7)
  assert.equal(controller.getState().saveError, '請修正工時設定後再儲存。')
  assert.equal(controller.getState().canSave, false)
  assert.equal(requests.filter(request => request.method === 'PUT').length, 0)

  controller.update(1, { startsAt: '10:00' })
  assert.equal(controller.getState().saveError, '')
  assert.equal(controller.getState().canSave, true)
  await controller.save(7)

  assert.equal(requests.filter(request => request.method === 'PUT').length, 1)
  assert.equal(controller.getState().message, '已儲存每週工時。')
  assert.equal(controller.getState().saveError, '')
})

test('staff hours controller retries a transient save failure without losing its draft', async () => {
  // Mutation caught: an unsuccessful PUT must not turn a valid draft into a
  // permanently disabled editor that requires remounting.
  let putAttempts = 0
  const controller = createStaffHoursController({
    fetchImpl: async (_url, options = {}) => {
      if (options.method !== 'PUT') return jsonResponse({ hours: weeklyHours() })
      putAttempts += 1
      return putAttempts === 1
        ? jsonResponse({ error: '暫時無法儲存。' }, false)
        : jsonResponse({ hours: weeklyHours() })
    },
  })

  await controller.load(7)
  controller.update(2, { endsAt: '18:30' })
  const draft = controller.getState().hours
  await controller.save(7)

  assert.equal(controller.getState().saveError, '暫時無法儲存。')
  assert.equal(controller.getState().canSave, true)
  assert.deepEqual(controller.getState().hours, draft)
  await controller.save(7)

  assert.equal(putAttempts, 2)
  assert.equal(controller.getState().saveError, '')
  assert.equal(controller.getState().message, '已儲存每週工時。')
})

test('staff hours controller stays disabled after a load failure until that staff reloads successfully', async () => {
  // Mutation caught: the editor must never PUT a stale/default draft when the
  // selected staff member's hours failed to load.
  let getAttempts = 0
  let puts = 0
  const controller = createStaffHoursController({
    fetchImpl: async (_url, options = {}) => {
      if (options.method === 'PUT') {
        puts += 1
        return jsonResponse({ hours: weeklyHours() })
      }
      getAttempts += 1
      return getAttempts === 1
        ? jsonResponse({ error: '未能載入工時。' }, false)
        : jsonResponse({ hours: weeklyHours() })
    },
  })

  await controller.load(7)
  assert.equal(controller.getState().loadError, '未能載入工時。')
  assert.equal(controller.getState().canSave, false)
  await controller.save(7)
  assert.equal(puts, 0)

  await controller.load(7)
  assert.equal(controller.getState().loadError, '')
  assert.equal(controller.getState().canSave, true)
})

test('staff hours controller ignores a late previous-staff load', async () => {
  // Mutation caught: losing the generation guard lets a late staff A result
  // enable staff B's editor with the wrong schedule.
  let resolveFirst
  const controller = createStaffHoursController({
    fetchImpl: (_url, options = {}) => {
      if (options.method === 'PUT') return Promise.resolve(jsonResponse({ hours: weeklyHours() }))
      if (!resolveFirst) return new Promise(resolve => { resolveFirst = resolve })
      return Promise.resolve(jsonResponse({ hours: weeklyHours().map(row => row.weekday === 1 ? { ...row, startsAt: '11:00' } : row) }))
    },
  })

  const first = controller.load(7)
  await controller.load(8)
  resolveFirst(jsonResponse({ hours: weeklyHours() }))
  await first

  assert.equal(controller.getState().staffId, 8)
  assert.equal(controller.getState().canSave, true)
  assert.equal(controller.getState().hours.find(row => row.weekday === 1).startsAt, '11:00')
})
