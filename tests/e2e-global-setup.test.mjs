import assert from 'node:assert/strict'
import test from 'node:test'
import { createGlobalSetup } from '../e2e/global-setup.mjs'

test('global setup makes teardown-ready after preflight and cleans partial seed failures', async () => {
  const events = []
  const setup = createGlobalSetup({
    preflight: async () => { events.push('preflight') },
    seed: async () => { events.push('seed'); throw new Error('partial seed') },
    cleanup: async () => { events.push('cleanup') },
    env: {},
  })
  await assert.rejects(setup(), /partial seed/)
  assert.deepEqual(events, ['preflight', 'seed', 'cleanup'])
})
