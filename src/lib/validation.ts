// Shared runtime request validation. Browser checks are convenience only;
// every rule here is enforced server-side before any data or money moves.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const MAX_BODY_BYTES = 100_000

export type ParsedBody =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: Response }

// Reads and parses a JSON request body with a hard size cap. Malformed or
// oversized payloads return a client error instead of crashing to a 500.
export async function parseJsonBody(
  request: Request,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<ParsedBody> {
  let text: string
  try {
    text = await request.text()
  } catch {
    return { ok: false, response: Response.json({ error: 'Unreadable request body' }, { status: 400 }) }
  }

  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, response: Response.json({ error: 'Request body too large' }, { status: 413 }) }
  }

  try {
    const body = JSON.parse(text)
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return { ok: false, response: Response.json({ error: 'Request body must be a JSON object' }, { status: 400 }) }
    }
    return { ok: true, body: body as Record<string, unknown> }
  } catch {
    return { ok: false, response: Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

// Returns the trimmed string when it is non-empty and within maxLength.
export function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > maxLength) return null
  return trimmed
}

// Optional variant: undefined/null/empty are fine, oversized is not.
export function cleanOptionalString(
  value: unknown,
  maxLength: number,
): { ok: boolean; value: string | null } {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, value: null }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) return { ok: false, value: null }
  return { ok: true, value: trimmed.length > 0 ? trimmed : null }
}

export function cleanStringArray(
  value: unknown,
  maxItems: number,
  maxItemLength: number,
): string[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > maxItems) return null
  const items: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return null
    const trimmed = item.trim()
    if (trimmed.length === 0 || trimmed.length > maxItemLength) return null
    items.push(trimmed)
  }
  return items
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// Optional YYYY-MM-DD date: undefined/null/empty are fine, anything else must
// be a real calendar date.
export function cleanOptionalDate(value: unknown): { ok: boolean; value: string | null } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return { ok: false, value: null }
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { ok: false, value: null }
  }
  return { ok: true, value }
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 })
}
