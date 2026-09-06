import { createClient } from '@supabase/supabase-js'
const db = createClient(
  'https://ekpsiteayqzceeuisqdc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrcHNpdGVheXF6Y2VldWlzcWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYxODg0MDAsImV4cCI6MjA0MTc2NDQwMH0.DA1VaVCL4BBDDpW6YxM5V9b5rB5W5KjJcGvL5W4aZfw'
)
const { data: packages, error } = await db.from('packages').select('id,name,is_active').limit(5)
if (error) { console.error('packages ERROR:', error.message); process.exit(1) }
console.log('packages count:', packages.length)
packages.forEach(p => console.log(' -', p.name, '| active:', p.is_active))

const { data: services, error: svcErr } = await db.from('services').select('id,name').limit(3)
if (svcErr) { console.error('services ERROR:', svcErr.message); process.exit(1) }
console.log('\nservices count:', services.length)
services.forEach(s => console.log(' -', s.name))
