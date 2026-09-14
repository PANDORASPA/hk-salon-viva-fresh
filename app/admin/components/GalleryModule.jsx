'use client'
import { useEffect, useState } from 'react'
import { adminApi, Feedback, Module, SaveButton, useSave } from './admin-module-ui'

export function GalleryModule() {
  const save = useSave()
  const [images, setImages] = useState([])
  const [loadError, setLoadError] = useState('')
  const [cleanupWarning, setCleanupWarning] = useState('')
  async function load() {
    setLoadError('')
    try { setImages((await adminApi('/api/admin/gallery')).images || []) }
    catch (error) { setLoadError(error.message) }
  }
  useEffect(() => { load() }, [])
  return <Module title="圖庫" intro="上載及管理公開圖片；所有資料變更均保留管理記錄。">
    <form onSubmit={async event => {
      event.preventDefault()
      const formNode = event.currentTarget
      const data = new FormData(formNode)
      const ok = await save.submit(() => adminApi('/api/admin/gallery', { method: 'POST', body: data }), '圖片已上載。')
      if (ok) { formNode.reset(); await load() }
    }}>
      <fieldset disabled={save.pending}>
        <legend>上載圖片</legend>
        <label>圖片<input type="file" name="file" accept="image/jpeg,image/png,image/webp" required/></label>
        <label>圖片說明<input name="altText" maxLength={200} required/></label>
        <SaveButton pending={save.pending}>上載圖片</SaveButton>
      </fieldset>
    </form>
    <Feedback {...save}/>
    {loadError ? <p role="alert">{loadError} <button type="button" onClick={load}>重試</button></p> : null}
    {cleanupWarning ? <p role="alert">{cleanupWarning}</p> : null}
    <div className="admin-gallery-list">{images.map(image => <article key={image.id}>
      <strong>{image.alt_text}</strong>
      <button type="button" disabled={save.pending} onClick={async () => {
        setCleanupWarning('')
        const ok = await save.submit(async () => {
          const result = await adminApi('/api/admin/gallery?id=' + image.id, { method: 'DELETE' })
          setCleanupWarning(result.cleanupWarning ? '網站記錄已移除，但圖片檔案清理失敗；請管理員檢查圖庫儲存空間。' : '')
        }, '圖片已從網站移除。')
        if (ok) await load()
      }}>移除</button>
    </article>)}</div>
  </Module>
}
