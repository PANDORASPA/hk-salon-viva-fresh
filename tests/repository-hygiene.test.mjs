import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

test('repository does not track secrets, runtime logs or browser captures', () => {
  const tracked = execFileSync('git', ['ls-files'], { encoding:'utf8' }).split(/\r?\n/).filter(Boolean)
  assert.equal(tracked.some((file) => /^\.env($|\.)/.test(file) && file !== '.env.example'), false)
  assert.equal(tracked.some((file) => /(^\.playwright-cli\/|\.log$|\.out\.log$|\.err\.log$)/.test(file)), false)
})
