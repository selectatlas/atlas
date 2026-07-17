// Validates user-supplied return paths (?next=) so post-auth redirects can
// only land on internal routes - never an external origin. Open redirects
// through a trusted domain are a phishing primitive, so anything not provably
// an internal path falls back.

const MAX_LENGTH = 512

export function safeInternalPath(raw: string | null | undefined, fallback = '/home'): string {
  if (!raw || raw.length > MAX_LENGTH) return fallback
  // Exactly one leading slash: "//host" is protocol-relative, and browsers
  // treat "/\host" the same way.
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback
  // No backslashes (slash-normalized by browsers) or whitespace anywhere.
  if (/[\s\\]/.test(raw)) return fallback
  // No control characters (CR/LF splitting, null bytes).
  for (const ch of raw) {
    const code = ch.charCodeAt(0)
    if (code <= 0x1f || code === 0x7f) return fallback
  }
  // Defense in depth: resolved against a known base, the path must stay on
  // that base's origin (catches any scheme or host smuggling the checks
  // above missed).
  try {
    const parsed = new URL(raw, 'https://internal.invalid')
    if (parsed.origin !== 'https://internal.invalid') return fallback
  } catch {
    return fallback
  }
  return raw
}
