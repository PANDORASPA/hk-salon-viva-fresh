'use client'
import {useEffect,useState} from 'react'
import {adminApi,Feedback,Module,SaveButton,useSave} from './admin-module-ui'
const contactFields=[['phone','電話'],['email','電郵'],['whatsapp','WhatsApp'],['instagram','Instagram 網址'],['address','地址'],['addressNote','到店提示']]
export default function SiteContentModule(){
  const save=useSave(),[data,setData]=useState(null),[loadError,setLoadError]=useState('')
  const load=()=>{setLoadError('');return adminApi('/api/admin/site-content').then(row=>setData(row.content.data)).catch(error=>setLoadError(error.message))}
  useEffect(()=>{load()},[])
  if(!data)return <Module title="網站內容">{loadError?<p role="alert">{loadError}<button onClick={load}>重試</button></p>:<p role="status">載入中…</p>}</Module>
  const set=(group,key,value)=>setData({...data,[group]:{...(data[group]||{}),[key]:value}})
  return <Module title="網站內容" intro="更新公開聯絡資料；留空的欄位不會顯示。"><form onSubmit={e=>{e.preventDefault();save.submit(()=>adminApi('/api/admin/site-content',{method:'PATCH',body:JSON.stringify({data})}),'已儲存並發佈。')}}><fieldset disabled={save.pending}><legend>品牌及聯絡</legend>
    <label>店舖名稱<input value={data.identity?.name||''} onChange={e=>set('identity','name',e.target.value)} required maxLength={160}/></label>
    <label>主標題<input value={data.identity?.heroTitle||''} onChange={e=>set('identity','heroTitle',e.target.value)} maxLength={500}/></label>
    {contactFields.map(([key,label])=><label key={key}>{label}<input type={key==='email'?'email':key==='instagram'?'url':'text'} value={data.contact?.[key]||''} onChange={e=>set('contact',key,e.target.value)} maxLength={key==='instagram'?2000:500}/></label>)}
    <SaveButton pending={save.pending}>儲存內容</SaveButton></fieldset></form><Feedback {...save}/></Module>
}
