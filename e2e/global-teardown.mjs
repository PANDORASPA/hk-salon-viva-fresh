import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
const run = promisify(execFile)
const script = fileURLToPath(new URL('../scripts/seed-e2e.mjs', import.meta.url))
export default async function globalTeardown() { if (process.env.E2E_RUNTIME_PREFLIGHT_PASSED === '1') await run(process.execPath, [script, 'cleanup'], { env: process.env }) }
