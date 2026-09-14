import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { promisify } from 'node:util'

const run = promisify(execFile)
const script = fileURLToPath(new URL('../scripts/seed-e2e.mjs', import.meta.url))

test('E2E seed command runs its safety preflight instead of silently succeeding', async () => {
  await assert.rejects(
    run(process.execPath, [script], { env: { PATH: process.env.PATH } }),
    (error) => error.code === 1 && /E2E preflight refused: E2E_TEST_PASSWORD is required/.test(error.stderr),
  )
})
