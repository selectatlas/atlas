import { describe, it, expect } from 'vitest'
import { parseJsonBody, isUuid, cleanString, cleanOptionalString, cleanStringArray, cleanOptionalDate } from './validation'

function jsonRequest(body: string) {
  return new Request('http://localhost/test', { method: 'POST', body })
}

describe('parseJsonBody', () => {
  it('parses a valid JSON object', async () => {
    const result = await parseJsonBody(jsonRequest('{"a": 1}'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.body).toEqual({ a: 1 })
  })

  it('rejects malformed JSON with 400', async () => {
    const result = await parseJsonBody(jsonRequest('{not json'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })

  it('rejects an empty body with 400', async () => {
    const result = await parseJsonBody(jsonRequest(''))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })

  it('rejects non-object JSON (array, string, number) with 400', async () => {
    for (const body of ['[1,2]', '"text"', '42', 'null']) {
      const result = await parseJsonBody(jsonRequest(body))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(400)
    }
  })

  it('rejects oversized payloads with 413', async () => {
    const result = await parseJsonBody(jsonRequest(`{"a": "${'x'.repeat(200_000)}"}`))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(413)
  })
})

describe('isUuid', () => {
  it('accepts valid UUIDs', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true)
    expect(isUuid(crypto.randomUUID())).toBe(true)
  })

  it('rejects non-UUID values', () => {
    expect(isUuid('talent-1')).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid(null)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
    expect(isUuid(42)).toBe(false)
    expect(isUuid("' or 1=1 --")).toBe(false)
  })
})

describe('cleanString', () => {
  it('trims and returns valid strings', () => {
    expect(cleanString('  hello  ', 10)).toBe('hello')
  })

  it('rejects empty, oversized, and non-string values', () => {
    expect(cleanString('   ', 10)).toBeNull()
    expect(cleanString('x'.repeat(11), 10)).toBeNull()
    expect(cleanString(42, 10)).toBeNull()
    expect(cleanString(undefined, 10)).toBeNull()
  })
})

describe('cleanOptionalString', () => {
  it('accepts absent values as null', () => {
    expect(cleanOptionalString(undefined, 10)).toEqual({ ok: true, value: null })
    expect(cleanOptionalString(null, 10)).toEqual({ ok: true, value: null })
    expect(cleanOptionalString('', 10)).toEqual({ ok: true, value: null })
  })

  it('rejects oversized and non-string values', () => {
    expect(cleanOptionalString('x'.repeat(11), 10).ok).toBe(false)
    expect(cleanOptionalString(42, 10).ok).toBe(false)
  })
})

describe('cleanStringArray', () => {
  it('accepts a valid array and absent values', () => {
    expect(cleanStringArray(['a', ' b '], 5, 10)).toEqual(['a', 'b'])
    expect(cleanStringArray(undefined, 5, 10)).toEqual([])
  })

  it('rejects too many items, oversized items, and non-strings', () => {
    expect(cleanStringArray(Array(6).fill('a'), 5, 10)).toBeNull()
    expect(cleanStringArray(['x'.repeat(11)], 5, 10)).toBeNull()
    expect(cleanStringArray([42], 5, 10)).toBeNull()
    expect(cleanStringArray('not-array', 5, 10)).toBeNull()
  })
})

describe('cleanOptionalDate', () => {
  it('accepts a valid date and absent values', () => {
    expect(cleanOptionalDate('2026-08-16')).toEqual({ ok: true, value: '2026-08-16' })
    expect(cleanOptionalDate(undefined)).toEqual({ ok: true, value: null })
    expect(cleanOptionalDate(null)).toEqual({ ok: true, value: null })
    expect(cleanOptionalDate('')).toEqual({ ok: true, value: null })
  })

  it('rejects malformed or impossible dates and non-strings', () => {
    expect(cleanOptionalDate('16/08/2026').ok).toBe(false)
    expect(cleanOptionalDate('2026-8-16').ok).toBe(false)
    expect(cleanOptionalDate('2026-02-30').ok).toBe(false)
    expect(cleanOptionalDate('2026-13-01').ok).toBe(false)
    expect(cleanOptionalDate(20260816).ok).toBe(false)
  })
})
