import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
const source=await readFile(new URL('../app/booking/BookingForm.jsx',import.meta.url),'utf8')
test('booking form loads server availability before submission',()=>{assert.match(source,/\/api\/availability/);assert.match(source,/slots/);assert.match(source,/disabled=.*slots/i)})
test('booking form submits structured appointment JSON',()=>{assert.match(source,/\/api\/appointments/);assert.match(source,/application\/json/);assert.match(source,/serviceId/);assert.match(source,/date/);assert.match(source,/time/)})
