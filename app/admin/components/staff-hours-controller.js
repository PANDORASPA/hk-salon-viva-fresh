import { validateWeeklyHours } from '../../../lib/validation/staff.js'

const readJson = response => response.json().catch(() => ({}))
const aborted = error => error?.name === 'AbortError'

export const createDefaultHours = () => Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  isWorking: weekday !== 0,
  startsAt: weekday === 0 ? null : '10:00',
  endsAt: weekday === 0 ? null : '19:00',
}))

export const createInitialStaffHoursState = () => ({
  staffId: null,
  hours: createDefaultHours(),
  loading: false,
  loadedStaffId: null,
  loadError: '',
  saveError: '',
  message: '',
  saving: false,
  canSave: false,
})

export function createStaffHoursController({ fetchImpl = fetch, onStateChange } = {}) {
  let generation = 0
  let activeRequest = null
  let state = createInitialStaffHoursState()

  const validation = () => validateWeeklyHours(state.hours)
  const recompute = () => {
    state = {
      ...state,
      canSave: !state.loading && !state.saving && state.loadedStaffId === state.staffId && validation().ok,
    }
  }
  const publish = () => onStateChange?.(getState())
  const updateState = patch => {
    state = { ...state, ...patch }
    recompute()
    publish()
  }
  const getState = () => ({ ...state, hours: state.hours.map(row => ({ ...row })) })

  const cancel = () => {
    generation += 1
    activeRequest?.abort()
    activeRequest = null
  }

  const load = async staffId => {
    const current = ++generation
    activeRequest?.abort()
    const request = new AbortController()
    activeRequest = request
    updateState({ staffId, loading: true, loadedStaffId: null, loadError: '', saveError: '', message: '', saving: false })
    try {
      const response = await fetchImpl(`/api/admin/staff/${staffId}/hours`, { signal: request.signal })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || '未能載入工時。')
      const loadedHours = data.hours?.length === 7 ? data.hours : createDefaultHours()
      const checked = validateWeeklyHours(loadedHours)
      if (!checked.ok) throw new Error('未能載入工時。')
      if (current === generation) updateState({ hours: checked.value, loadedStaffId: staffId, loadError: '' })
    } catch (cause) {
      if (current === generation && !aborted(cause)) updateState({ loadError: cause.message || '未能載入工時。', loadedStaffId: null })
    } finally {
      if (current === generation) {
        activeRequest = null
        updateState({ loading: false })
      }
    }
  }

  const update = (weekday, patch) => {
    if (state.saving || state.loading) return
    updateState({
      hours: state.hours.map(row => row.weekday === weekday ? { ...row, ...patch } : row),
      saveError: '',
      message: '',
    })
  }

  const save = async staffId => {
    if (state.staffId !== staffId || state.loadedStaffId !== staffId || state.loading || state.saving) return
    const checked = validation()
    if (!checked.ok) {
      updateState({ saveError: '請修正工時設定後再儲存。', message: '' })
      return
    }

    const current = generation
    updateState({ saving: true, saveError: '', message: '' })
    try {
      const response = await fetchImpl(`/api/admin/staff/${staffId}/hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: checked.value }),
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || '未能儲存工時。')
      if (current === generation && state.staffId === staffId) updateState({ message: '已儲存每週工時。', saveError: '' })
    } catch (cause) {
      if (current === generation && state.staffId === staffId) updateState({ saveError: cause.message || '未能儲存工時。', message: '' })
    } finally {
      if (current === generation && state.staffId === staffId) updateState({ saving: false })
    }
  }

  return { load, update, save, cancel, getState }
}
