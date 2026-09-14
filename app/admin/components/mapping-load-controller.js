export function createMappingLoadController({ load, publish }) {
  let generation = 0; let abort = null
  async function reload() {
    generation += 1; const current = generation; abort?.abort(); abort = new AbortController()
    publish({ loading: true, error: '', rows: [], ready: false })
    try { const rows = await load(abort.signal); if (current === generation && !abort.signal.aborted) publish({ loading: false, error: '', rows, ready: true }) }
    catch (error) { if (current === generation && !abort.signal.aborted) publish({ loading: false, error: error.message || '暫時未能載入選項。', rows: [], ready: false }) }
  }
  return { reload, dispose() { generation += 1; abort?.abort() } }
}
