import { AsyncLocalStorage } from 'node:async_hooks'

// Next's server bootstrap supplies this global before loading its web adapters.
globalThis.AsyncLocalStorage ??= AsyncLocalStorage
const { NextRequest, NextResponse } = await import('next/server.js')
export { NextRequest, NextResponse }
