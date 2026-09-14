import assert from 'node:assert/strict'
import test from 'node:test'

import { createBookingCalendarController, createBookingCalendarControllerLifecycle } from '../app/admin/components/booking-calendar-controller.js'

const deferred = () => {
  let resolve
  const promise = new Promise(next => { resolve = next })
  return { promise, resolve }
}
const jsonResponse = body => ({ ok: true, json: async () => body })

test('calendar controller ignores a late result after a newer filtered load', async () => {
  // Mutation caught: removing either the request generation check or abort
  // means the older day/filter response can overwrite the newer calendar.
  const requests = []
  const shownRows = []
  const controller = createBookingCalendarController({
    fetchImpl: (url, options) => {
      const next = deferred()
      requests.push({ url, signal: options.signal, ...next })
      return next.promise
    },
    onLoadSuccess: data => shownRows.push(data.rows),
  })

  const first = controller.load({ day: '2026-09-14', endDay: '2026-09-14', staffFilter: '', statusFilter: '', serviceFilter: '' })
  const second = controller.load({ day: '2026-09-15', endDay: '2026-09-21', staffFilter: '7', statusFilter: 'confirmed', serviceFilter: '3' })
  assert.equal(requests[0].signal.aborted, true)

  requests[2].resolve(jsonResponse({ appointments: [{ id: 22 }] }))
  requests[3].resolve(jsonResponse({ staff: [], services: [] }))
  await second
  requests[0].resolve(jsonResponse({ appointments: [{ id: 11 }] }))
  requests[1].resolve(jsonResponse({ staff: [], services: [] }))
  await first

  assert.deepEqual(shownRows, [[{ id: 22 }]])
  assert.match(requests[2].url, /from=2026-09-15/)
  assert.match(requests[2].url, /staffId=7/)
  assert.match(requests[2].url, /status=confirmed/)
  assert.match(requests[2].url, /serviceId=3/)
})

test('calendar controller surfaces a successful mutation notification warning', async () => {
  // Mutation caught: closing the create form without passing the successful
  // API response warning to the mounted calendar state.
  let warning = false
  const controller = createBookingCalendarController({
    fetchImpl: async () => jsonResponse({ appointment: { id: 4 }, notificationWarning: true }),
    onMutationSuccess: result => { warning = result.notificationWarning },
  })

  await controller.mutate('POST', { customerName: 'Ada' })

  assert.equal(warning, true)
})

test('calendar controller refreshes live criteria after save and status mutations without accepting old rows', async () => {
  // Mutation caught: completing a Sep 14 mutation after the calendar moves to
  // Sep 20 must not re-fetch or re-render the captured Sep 14 criteria.
  for (const method of ['POST', 'PATCH']) {
    const criteria = { current: { day: '2026-09-14', endDay: '2026-09-14', staffFilter: '', statusFilter: '', serviceFilter: '' } }
    const requests = []
    const mutations = []
    const shownRows = []
    const controller = createBookingCalendarController({
      getCriteria: () => criteria.current,
      fetchImpl: (url, options = {}) => {
        if (url === '/api/admin/appointments') {
          const next = deferred()
          mutations.push(next)
          return next.promise
        }
        const next = deferred()
        requests.push({ url, ...next })
        return next.promise
      },
      onLoadSuccess: data => shownRows.push(data.rows),
    })

    const oldLoad = controller.load(criteria.current)
    const mutation = controller.mutate(method, { id: 4 }, { refreshAfterMutation: true })
    criteria.current = { day: '2026-09-20', endDay: '2026-09-20', staffFilter: '7', statusFilter: 'confirmed', serviceFilter: '3' }
    const switchedLoad = controller.load(criteria.current)
    mutations[0].resolve(jsonResponse({ appointment: { id: 4 } }))
    await mutation

    assert.equal(requests.length, 6)
    assert.match(requests[4].url, /from=2026-09-20/)
    assert.match(requests[4].url, /staffId=7/)
    requests[4].resolve(jsonResponse({ appointments: [{ id: `${method}-fresh` }] }))
    requests[5].resolve(jsonResponse({ staff: [], services: [] }))
    await new Promise(resolve => setImmediate(resolve))
    requests[0].resolve(jsonResponse({ appointments: [{ id: `${method}-old` }] }))
    requests[1].resolve(jsonResponse({ staff: [], services: [] }))
    requests[2].resolve(jsonResponse({ appointments: [{ id: `${method}-prior-current` }] }))
    requests[3].resolve(jsonResponse({ staff: [], services: [] }))
    await Promise.all([oldLoad, switchedLoad])

    assert.deepEqual(shownRows, [[{ id: `${method}-fresh` }]])
  }
})

test('calendar controller skips mutation callbacks and refresh after disposal', async () => {
  // Mutation caught: an unmounted calendar must not set warning state or start
  // a fresh request when an in-flight mutation finishes.
  const mutation = deferred()
  let refreshes = 0
  let warnings = 0
  const controller = createBookingCalendarController({
    getCriteria: () => ({ day: '2026-09-20', endDay: '2026-09-20' }),
    fetchImpl: url => {
      if (url === '/api/admin/appointments') return mutation.promise
      refreshes += 1
      return Promise.resolve(jsonResponse({ appointments: [], staff: [], services: [] }))
    },
    onMutationSuccess: () => { warnings += 1 },
  })

  const pending = controller.mutate('POST', { customerName: 'Ada' }, { refreshAfterMutation: true })
  controller.dispose()
  mutation.resolve(jsonResponse({ appointment: { id: 5 }, notificationWarning: true }))
  await pending

  assert.equal(warnings, 0)
  assert.equal(refreshes, 0)
})

test('calendar lifecycle recreates a usable controller after Strict Effects replay', async () => {
  // Mutation caught: permanently disposing the render-created controller
  // makes the Strict Mode setup → cleanup → setup replay render no calendar.
  const criteria = { current: { day: '2026-09-14', endDay: '2026-09-14', staffFilter: '', statusFilter: '', serviceFilter: '' } }
  const requests = []
  const mutation = deferred()
  const shownRows = []
  const lifecycle = createBookingCalendarControllerLifecycle(() => createBookingCalendarController({
    getCriteria: () => criteria.current,
    fetchImpl: url => {
      if (url === '/api/admin/appointments') return mutation.promise
      const next = deferred()
      requests.push({ url, ...next })
      return next.promise
    },
    onLoadSuccess: data => shownRows.push(data.rows),
  }))

  const first = lifecycle.setup()
  const firstLoad = first.load(criteria.current)
  lifecycle.cleanup(first)
  const second = lifecycle.setup()
  const replayLoad = second.load(criteria.current)
  assert.notEqual(second, first)

  criteria.current = { day: '2026-09-20', endDay: '2026-09-20', staffFilter: '7', statusFilter: 'confirmed', serviceFilter: '3' }
  const filteredLoad = second.load(criteria.current)
  const saving = second.mutate('POST', { id: 4 }, { refreshAfterMutation: true })
  mutation.resolve(jsonResponse({ appointment: { id: 4 } }))
  await saving

  assert.equal(requests.length, 8)
  assert.match(requests[6].url, /from=2026-09-20/)
  assert.match(requests[6].url, /serviceId=3/)
  requests[6].resolve(jsonResponse({ appointments: [{ id: 'strict-fresh' }] }))
  requests[7].resolve(jsonResponse({ staff: [], services: [] }))
  await new Promise(resolve => setImmediate(resolve))
  for (const request of requests.slice(0, 6)) request.resolve(jsonResponse(request.url.includes('operations') ? { staff: [], services: [] } : { appointments: [{ id: 'stale' }] }))
  await Promise.all([firstLoad, replayLoad, filteredLoad])

  assert.deepEqual(shownRows, [[{ id: 'strict-fresh' }]])
  lifecycle.cleanup(second)
  assert.equal(lifecycle.current(), null)
})
