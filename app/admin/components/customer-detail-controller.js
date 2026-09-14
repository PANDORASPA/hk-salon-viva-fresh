export function createCustomerDetailController({ load, publish }) {
  let generation = 0
  let abort = null
  const select = async (id) => {
    generation += 1
    const current = generation
    abort?.abort()
    abort = new AbortController()
    publish({ loading: true, error: '', detail: null, draftCustomerId: id })
    try {
      const detail = await load(id, abort.signal)
      if (current === generation && !abort.signal.aborted) publish({ loading: false, error: '', detail, draftCustomerId: id })
    } catch (error) {
      if (current === generation && !abort.signal.aborted) publish({ loading: false, error: error.message || '暫時未能載入客戶資料。', detail: null, draftCustomerId: id })
    }
  }
  return { select, dispose() { generation += 1; abort?.abort() } }
}
