import assert from 'node:assert/strict'
import test from 'node:test'

import { createBookingCalendarController } from '../app/admin/components/booking-calendar-controller.js'

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
