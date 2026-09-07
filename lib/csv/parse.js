/**
 * Minimal RFC 4180 CSV parser.
 *
 * Handles:
 *   - quoted fields containing commas, newlines, and escaped quotes (")
 *   - CRLF, LF, and CR line endings
 *   - blank lines (skipped)
 *   - leading/trailing whitespace inside fields is preserved
 *
 * Returns `{ headers, rows }` where headers is a string[] and rows is
 * `Array<Record<string, string>>`. Each header is trimmed; values are not
 * trimmed (callers may need to do that for fields that get inserted into
 * a database with a CHECK constraint on `length(trim(x))`).
 *
 * Not handled: BOM detection (the caller may strip it), schema inference,
 * and type coercion. Pass `headers` explicitly when the file is missing
 * a header row.
 */

export function parseCsv(text, { skipEmptyLines = true, headers: explicitHeaders = null } = {}) {
  if (typeof text !== 'string') throw new TypeError('parseCsv: text must be a string')
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

  const records = []
  let field = ''
  let row = []
  let inQuotes = false
  let i = 0
  const len = text.length

  while (i < len) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\r') {
      // Handle CRLF or bare CR as line terminator
      row.push(field)
      records.push(row)
      row = []
      field = ''
      if (text[i + 1] === '\n') i += 2
      else i += 1
      continue
    }
    if (ch === '\n') {
      row.push(field)
      records.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += ch
    i += 1
  }

  // Flush trailing field/row
  if (field !== '' || row.length > 0) {
    row.push(field)
    records.push(row)
  }

  // Drop fully-empty trailing row that always appears when text ends in a newline
  if (records.length && records[records.length - 1].length === 1 && records[records.length - 1][0] === '') {
    records.pop()
  }

  if (records.length === 0) {
    return { headers: explicitHeaders || [], rows: [] }
  }

  let headers
  let body
  if (explicitHeaders) {
    headers = explicitHeaders.map((h) => String(h).trim())
    body = records
  } else {
    headers = records[0].map((h) => String(h).trim())
    body = records.slice(1)
  }

  const rows = []
  for (const r of body) {
    if (skipEmptyLines && r.length === 1 && r[0] === '') continue
    const obj = {}
    for (let c = 0; c < headers.length; c += 1) {
      obj[headers[c]] = r[c] === undefined ? '' : r[c]
    }
    rows.push(obj)
  }
  return { headers, rows }
}

export const __testing = { parseCsv }

export default { parseCsv, __testing }
