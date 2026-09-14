'use client'
import { useEffect,useState } from 'react'
import { adminApi, Feedback, SaveButton, useSave } from './admin-module-ui'
import StaffHoursEditor from './StaffHoursEditor'
import TimeOffEditor from './TimeOffEditor'
const blank={name:'',displayName:'',bio:'',colourHex:'#a98152',isActive:true,sortOrder:0,serviceIds:[]}
export default function StaffModule(){
  const save=useSave()
  const [staff,setStaff]=useState([]),[services,setServices]=useState([]),[selected,setSelected]=useState(null),[draft,setDraft]=useState(blank)
  const [loading,setLoading]=useState(true),[error,setError]=useState('')
  const load=async()=>{setLoading(true);setError('');try{const [people,items]=await Promise.all([adminApi('/api/admin/staff'),adminApi('/api/admin/services')]);setStaff(people.staff||[]);setServices(items.services||[])}catch(cause){setError(cause.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  const edit=row=>{setSelected(row);setDraft({name:row.name,displayName:row.displayName,bio:row.bio||'',colourHex:row.colourHex,isActive:row.isActive,sortOrder:row.sortOrder,serviceIds:row.serviceIds||[]})}
  const submit=async event=>{event.preventDefault();const ok=await save.submit(()=>adminApi(selected?`/api/admin/staff/${selected.id}`:'/api/admin/staff',{method:selected?'PATCH':'POST',body:JSON.stringify(draft)}));if(ok){setDraft(blank);setSelected(null);load()}}
  return <section className="admin-module" aria-labelledby="staff-title"><h2 id="staff-title">員工及排班</h2><p>停用前必須先處理該員工尚未結束的預約。</p>
    {error?<p role="alert">{error}<button onClick={load}>重試</button></p>:null}<Feedback {...save}/>
    <form onSubmit={submit}><fieldset className="staff-form" disabled={save.pending||loading}><legend>{selected?'編輯員工':'新增員工'}</legend>
      <label>姓名<input required minLength={2} maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label>顯示名稱<input required minLength={2} maxLength={120} value={draft.displayName} onChange={e=>setDraft({...draft,displayName:e.target.value})}/></label>
      <label>排序<input type="number" value={draft.sortOrder} onChange={e=>setDraft({...draft,sortOrder:Number(e.target.value)})}/></label>
      <label>顏色<input type="color" value={draft.colourHex} onChange={e=>setDraft({...draft,colourHex:e.target.value})}/></label>
      <label><input type="checkbox" checked={draft.isActive} onChange={e=>setDraft({...draft,isActive:e.target.checked})}/>啟用員工</label>
      <label>簡介<textarea maxLength={2000} value={draft.bio} onChange={e=>setDraft({...draft,bio:e.target.value})}/></label>
      <fieldset><legend>可提供服務</legend>{services.map(row=><label key={row.id}><input type="checkbox" checked={draft.serviceIds.includes(row.id)} onChange={e=>setDraft({...draft,serviceIds:e.target.checked?[...draft.serviceIds,row.id]:draft.serviceIds.filter(id=>id!==row.id)})}/>{row.name}</label>)}</fieldset>
      <SaveButton pending={save.pending}>{selected?'儲存員工':'新增員工'}</SaveButton>{selected?<button type="button" onClick={()=>{setSelected(null);setDraft(blank)}}>取消編輯</button>:null}
    </fieldset></form>{loading?<p role="status">正在載入員工…</p>:<ul className="staff-list">{staff.map(row=><li key={row.id}><button type="button" disabled={save.pending} onClick={()=>edit(row)}><strong>{row.displayName}</strong><span>{row.isActive?'啟用':'停用'} · {row.serviceIds.length} 項服務</span></button></li>)}</ul>}
    {selected?<div className="staff-editors"><StaffHoursEditor key={`hours-${selected.id}`} staffId={selected.id}/><TimeOffEditor key={`off-${selected.id}`} staffId={selected.id}/></div>:<p>選擇員工以管理工時及休假。</p>}
  </section>
}
