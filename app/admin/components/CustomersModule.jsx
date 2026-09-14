'use client'
import {useEffect,useRef,useState} from 'react'
import {adminApi,Feedback,Module,SaveButton,Status,useAdminRows,useSave} from './admin-module-ui'
import {createCustomerDetailController} from './customer-detail-controller'

function CustomerEditor({customer,onSaved}){
  const save=useSave(),[form,setForm]=useState({name:customer?.name||'',phone:customer?.phone||'',email:customer?.email||'',notes:customer?.notes||''})
  const submit=async e=>{e.preventDefault();const ok=await save.submit(()=>adminApi(customer?`/api/admin/customers/${customer.id}`:'/api/admin/customers',{method:customer?'PATCH':'POST',body:JSON.stringify(form)}));if(ok)onSaved()}
  return <form onSubmit={submit}><fieldset disabled={save.pending}><legend>{customer?'編輯客戶':'新增客戶'}</legend>
    <label>姓名<input required minLength={2} maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>電話<input type="tel" maxLength={30} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
    <label>電郵<input type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label>內部備註<textarea maxLength={2000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    <SaveButton pending={save.pending}>{customer?'儲存客戶':'建立客戶'}</SaveButton></fieldset><Feedback {...save}/></form>
}

function ManualIssue({customer,onSaved}){
  const resource=useAdminRows('/api/admin/packages','packages'),save=useSave(),[packageId,setPackageId]=useState(''),[reason,setReason]=useState('')
  const attempt=useRef(null)
  const submit=async event=>{
    event.preventDefault()
    // Keep exactly the same request on network retry, even if delivery was
    // committed but its response was lost. A new form starts a new intention.
    if(!attempt.current)attempt.current={customerId:customer.id,packageId:Number(packageId),reason,requestKey:crypto.randomUUID()}
    const ok=await save.submit(()=>adminApi('/api/admin/customer-packages',{method:'POST',body:JSON.stringify(attempt.current)}),'套票已派發。')
    if(ok){attempt.current=null;setReason('');setPackageId('');onSaved()}
  }
  if(!customer.user_id)return <p>手動派發套票前，客戶需先登入建立帳戶；不會按電話自動綁定。</p>
  return <form onSubmit={submit}><fieldset disabled={save.pending||resource.loading}><legend>手動派發套票</legend><Status {...resource}><label>套票<select required value={packageId} disabled={Boolean(attempt.current)} onChange={e=>setPackageId(e.target.value)}><option value="">選擇套票</option>{resource.rows.filter(row=>row.is_active).map(row=><option value={row.id} key={row.id}>{row.name} · {row.total_sessions} 次</option>)}</select></label><label>派發原因<input required maxLength={500} disabled={Boolean(attempt.current)} value={reason} onChange={e=>setReason(e.target.value)}/></label><SaveButton pending={save.pending} disabled={!packageId||!reason.trim()||Boolean(resource.error)}>{attempt.current?'重試同一派發':'派發套票'}</SaveButton></Status></fieldset><Feedback {...save}/></form>
}

export default function CustomersModule(){
  const resource=useAdminRows('/api/admin/customers','customers'),save=useSave()
  const [detailState,setDetailState]=useState({detail:null,loading:false,error:'',draftCustomerId:null}),[creating,setCreating]=useState(false),[reason,setReason]=useState(''),[delta,setDelta]=useState(0)
  const controller=useRef(null),detail=detailState.detail
  if(!controller.current)controller.current=createCustomerDetailController({load:async(id,signal)=>(await adminApi(`/api/admin/customers/${id}`,{signal})).customer,publish:setDetailState})
  useEffect(()=>()=>controller.current?.dispose(),[])
  const loadDetail=id=>{setReason('');setDelta(0);return controller.current.select(id)}
  const refresh=id=>{resource.load();if(controller.current.isCurrent(id))loadDetail(id)}
  const mutate=async(item,body)=>{const customerId=detail.id;const ok=await save.submit(()=>adminApi(`/api/admin/customer-packages/${item.id}`,{method:'PATCH',body:JSON.stringify(body)}),'已記錄調整。');if(ok&&controller.current.isCurrent(customerId))refresh(customerId)}
  return <Module title="客戶記錄" intro="管理聯絡資料、預約、套票及經審計的調整。"><button type="button" onClick={()=>setCreating(value=>!value)}>{creating?'關閉新增':'新增客戶'}</button>
    {creating?<CustomerEditor onSaved={()=>{setCreating(false);resource.load()}}/>:null}<Feedback {...save}/>
    <Status {...resource}><div className="admin-list">{resource.rows.map(customer=><article key={customer.id}><div><strong>{customer.name}</strong><p>{customer.phone}</p></div><button type="button" disabled={save.pending} onClick={()=>loadDetail(customer.id)}>詳情</button></article>)}</div></Status>
    {detailState.loading?<p role="status">載入客戶資料中…</p>:null}{detailState.error?<p role="alert">{detailState.error}<button onClick={()=>loadDetail(detailState.draftCustomerId)}>重試</button></p>:null}
    {detail?<section key={detail.id}><h3>{detail.name} 的記錄</h3><CustomerEditor customer={detail} onSaved={()=>refresh(detail.id)}/><ManualIssue customer={detail} onSaved={()=>refresh(detail.id)}/>
      <h4>套票及兌換</h4><fieldset disabled={save.pending}><legend>套票調整</legend><label>調整原因（必填）<input value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/></label><label>調整次數<input type="number" value={delta} onChange={e=>setDelta(Number(e.target.value))}/></label>
      {detail.customer_packages?.map(item=><article key={item.id}><strong>{item.packages?.name}</strong><p>餘額：{item.sessions_remaining} / {item.total_sessions} · {item.is_active?'啟用':'停用'}</p><SaveButton pending={save.pending} disabled={!reason.trim()||!delta} onClick={()=>mutate(item,{adjustment:delta,reason})}>儲存調整</SaveButton><SaveButton pending={save.pending} disabled={!reason.trim()} onClick={()=>mutate(item,{isActive:!item.is_active,reason})}>{item.is_active?'停用客戶套票':'啟用客戶套票'}</SaveButton></article>)}</fieldset>
      <h4>預約</h4>{detail.appointments?.map(row=><p key={row.id}>{row.reference} · {row.status}</p>)}<h4>兌換記錄</h4>{detail.customer_packages?.flatMap(item=>item.package_redemptions||[]).map(row=><p key={row.id}>{row.redeemed_at}{row.refunded_at?' · 已退回':''}</p>)}
    </section>:null}</Module>
}
