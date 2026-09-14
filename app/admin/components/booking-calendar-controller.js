const readJson = response => response.json().catch(() => ({}))
const aborted = error => error?.name === 'AbortError'

export function createBookingCalendarController({
  fetchImpl = fetch,
  onLoadStart,
  onLoadSuccess,
  onLoadFailure,
  onLoadFinish,
  onMutationSuccess,
  onMutationFailure,
} = {}) {
  let generation = 0
  let activeRequest = null

  const cancel = () => {
    generation += 1
    activeRequest?.abort()
    activeRequest = null
  }

  const load = async ({ day, endDay, staffFilter, statusFilter, serviceFilter }) => {
    const current = ++generation
    activeRequest?.abort()
    const request = new AbortController()
    activeRequest = request
    onLoadStart?.()
    try {
      const filters = new URLSearchParams({ from: day, to: endDay })
      if (staffFilter) filters.set('staffId', staffFilter)
      if (statusFilter) filters.set('status', statusFilter)
      if (serviceFilter) filters.set('serviceId', serviceFilter)
      const [appointments, operations] = await Promise.all([
        fetchImpl(`/api/admin/appointments?${filters}`, { signal: request.signal }),
        fetchImpl('/api/admin/operations', { signal: request.signal }),
      ])
      const [appointmentData, operationData] = await Promise.all([readJson(appointments), readJson(operations)])
      if (!appointments.ok) throw new Error(appointmentData.error || '未能載入預約。')
      if (!operations.ok) throw new Error(operationData.error || '未能載入篩選資料。')
      if (current === generation) onLoadSuccess?.({ rows: appointmentData.appointments || [], staff: operationData.staff || [], services: operationData.services || [] })
    } catch (error) {
      if (current === generation && !aborted(error)) onLoadFailure?.(error)
    } finally {
      if (current === generation) {
        activeRequest = null
        onLoadFinish?.()
      }
    }
  }

  const mutate = async (method, payload) => {
    try {
      const response = await fetchImpl('/api/admin/appointments', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await readJson(response)
      if (!response.ok) throw new Error(result.error || '未能儲存預約。')
      onMutationSuccess?.(result)
      return result
    } catch (error) {
      onMutationFailure?.(error)
      throw error
    }
  }

  return { load, cancel, mutate }
}
