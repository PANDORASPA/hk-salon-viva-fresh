import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { execFileSync } from 'child_process'
import { pathToFileURL } from 'url'

const root = process.cwd()
const ignoredDirs = new Set(['.git', '.next', '.npm-cache', 'node_modules'])
const ignoredFiles = new Set(['.env.local'])
const secretNames = String.raw`(SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|WEBHOOK)[A-Z0-9_]*)`
const secretTokenPattern = new RegExp(String.raw`\b${secretNames}\b`, 'g')

const harmlessValue = value => {
  const normalized = value.replace(/^['"`]|['"`]$/g, '')
  return normalized === '' || /^<[^>]+>$/.test(normalized) || /^your-[a-z0-9-]+$/i.test(normalized)
}

const labelFor = name => {
  if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'Supabase service role key'
  if (name === 'STRIPE_SECRET_KEY') return 'Stripe secret key'
  if (name === 'STRIPE_WEBHOOK_SECRET') return 'Stripe webhook secret'
  return 'Secret env exposed publicly'
}

const lineAt = (text, index) => text.slice(0, index).split(/\r?\n/).length

function maskNonCode(text) {
  const mask = text.split('')
  const hide = index => { if (mask[index] !== '\n' && mask[index] !== '\r') mask[index] = ' ' }
  let quote = null
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quote) {
      hide(index)
      if (char === '\\') { hide(index + 1); index += 1 }
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; hide(index); continue }
    if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') { hide(index); index += 1 }
      continue
    }
    if (char === '/' && next === '*') {
      hide(index); hide(index + 1); index += 2
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) { hide(index); index += 1 }
      hide(index); hide(index + 1); index += 1
      continue
    }
    if (char === '#' && (index === 0 || /\s/.test(text[index - 1]))) {
      while (index < text.length && text[index] !== '\n') { hide(index); index += 1 }
    }
  }
  return mask.join('')
}

function skipTrivia(text, index, { allowNewlines = false } = {}) {
  let cursor = index
  while (cursor < text.length) {
    while (/\s/.test(text[cursor] || '')) {
      if (!allowNewlines && /\r|\n/.test(text[cursor])) return cursor
      cursor += 1
    }
    if (text.startsWith('//', cursor)) {
      cursor = text.indexOf('\n', cursor + 2)
      if (cursor === -1) return text.length
      if (!allowNewlines) return cursor
      continue
    }
    if (text.startsWith('/*', cursor)) {
      const end = text.indexOf('*/', cursor + 2)
      if (end === -1) return text.length
      cursor = end + 2
      continue
    }
    if (text[cursor] === '#') {
      cursor = text.indexOf('\n', cursor + 1)
      if (cursor === -1) return text.length
      if (!allowNewlines) return cursor
      continue
    }
    break
  }
  return cursor
}

function readLiteral(text, index, allowBare) {
  const quote = text[index]
  if (quote === '"' || quote === "'" || quote === '`') {
    let cursor = index + 1
    for (; cursor < text.length && cursor - index <= 4096; cursor += 1) {
      if (text[cursor] === '\\') { cursor += 1; continue }
      if (quote !== '`' && /\r|\n/.test(text[cursor])) return null
      if (quote === '`' && text[cursor] === '$' && text[cursor + 1] === '{') return null
      if (text[cursor] === quote) return { value: text.slice(index, cursor + 1) }
    }
    return null
  }
  if (quote === '<') {
    const end = text.indexOf('>', index + 1)
    return end === -1 || end - index > 4096 ? null : { value: text.slice(index, end + 1) }
  }
  if (!allowBare) return null
  const end = text.slice(index).search(/[\s,;#&|]/)
  const value = end === -1 ? text.slice(index) : text.slice(index, index + end)
  if (!value || /[${}()[\]?+]/.test(value) || /^(?:process|import|require)\b/.test(value)) return null
  return { value }
}

function statementStart(mask, index) {
  return Math.max(mask.lastIndexOf(';', index - 1), mask.lastIndexOf('{', index - 1), mask.lastIndexOf('}', index - 1)) + 1
}

function typeAnnotationEquals(mask, index) {
  for (let cursor = index + 1; cursor < mask.length && cursor - index <= 4096; cursor += 1) {
    if (mask[cursor] === '=') return cursor
    if (',;{}'.includes(mask[cursor])) return -1
  }
  return -1
}

function fileAllowsBareValue(file) {
  return /(?:^|[/\\])\.env(?:\.|$)|\.(?:sh|bash|zsh|ps1|psm1)$/i.test(file)
}

export function scanText(file, text) {
  const mask = maskNonCode(text)
  const matches = []
  const addMatch = (name, value, index) => {
    if (harmlessValue(value)) return
    matches.push({ index, line: lineAt(text, index), label: labelFor(name) })
  }
  for (const token of mask.matchAll(secretTokenPattern)) {
    const name = token[1]
    const nameIndex = token.index
    const before = mask.slice(statementStart(mask, nameIndex), nameIndex)
    const isDeclaration = /\b(?:const|let|var)\b/.test(before)
    const lineStart = Math.max(mask.lastIndexOf('\n', nameIndex - 1), mask.lastIndexOf(';', nameIndex - 1), mask.lastIndexOf('&', nameIndex - 1), mask.lastIndexOf('|', nameIndex - 1)) + 1
    const isShell = /\b(?:export|set)\b/i.test(mask.slice(lineStart, nameIndex))
    const isPowerShell = /\$env:\s*$/i.test(mask.slice(Math.max(0, nameIndex - 6), nameIndex))
    let operator = skipTrivia(text, nameIndex + name.length, { allowNewlines: true })
    let kind = null
    if (mask[operator] === '=') {
      kind = isPowerShell ? 'shell' : (isDeclaration ? 'declaration' : 'assignment')
      operator = skipTrivia(text, operator + 1, { allowNewlines: kind === 'declaration' })
    } else if (mask[operator] === ':' && isDeclaration) {
      const equals = typeAnnotationEquals(mask, operator)
      if (equals !== -1) {
        kind = 'declaration'
        operator = skipTrivia(text, equals + 1, { allowNewlines: true })
      }
    } else if (mask[operator] === ':') {
      kind = 'object'
      operator = skipTrivia(text, operator + 1, { allowNewlines: true })
    }
    if (!kind) continue
    const literal = readLiteral(text, operator, isShell || isPowerShell || fileAllowsBareValue(file))
    if (literal) addMatch(name, literal.value, nameIndex)
  }
  return matches
    .sort((left, right) => left.index - right.index)
    .filter((match, index, sorted) => index === 0 || match.index !== sorted[index - 1].index)
    .map(({ line, label }) => ({ line, label }))
}

export function scanRepository(root = process.cwd()) {
  const findings = []

try {
  const tracked = execFileSync('git', ['ls-files'], { encoding:'utf8' }).split(/\r?\n/)
  for (const file of tracked) {
    if (/^\.env($|\.)/.test(file) && file !== '.env.example') findings.push({ file, line:1, label:'Tracked environment file' })
  }
} catch {
  // The content scan below remains useful outside a Git checkout.
}

  const scanFile = (path) => {
  const rel = relative(root, path).replaceAll('\\', '/')
  if (ignoredFiles.has(rel)) return
  const text = readFileSync(path, 'utf8')
    scanText(rel, text).forEach(finding => findings.push({ ...finding, file: rel }))
  }

  const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      walk(path)
    } else if (/\.(js|jsx|mjs|ts|tsx|json|md|sql|yml|yaml|env|toml|sh|bash|zsh|ps1|psm1)$/i.test(entry) || /^\.env(?:\.|$)/i.test(entry)) {
      scanFile(path)
    }
  }
  }

  walk(root)
  return findings
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = scanRepository()
  if (findings.length > 0) {
    console.error('Security scan failed:')
    findings.forEach((finding) => {
      console.error(`- ${finding.label}: ${finding.file}:${finding.line}`)
    })
    process.exitCode = 1
  } else {
    console.log('Security scan passed.')
  }
}
