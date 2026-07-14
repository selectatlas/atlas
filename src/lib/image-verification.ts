// Server-side image content verification. Browser MIME claims are
// attacker-controlled; verify actual file signatures (magic bytes) so
// non-image and polyglot payloads are rejected before storage.

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((byte, i) => bytes[offset + i] === byte)
}

// Returns the verified MIME type from file content, or null when the bytes
// are not a supported image format.
export function sniffImageType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  // WebP: "RIFF" .... "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp'
  }
  return null
}

export type ImageVerification =
  | { ok: true; mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; extension: string }
  | { ok: false; reason: string }

export function verifyImage(bytes: Uint8Array, declaredType: string): ImageVerification {
  if (bytes.byteLength === 0) return { ok: false, reason: 'File is empty' }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, reason: 'Image must be under 5MB' }
  }
  if (!(declaredType in ALLOWED_IMAGE_TYPES)) {
    return { ok: false, reason: 'Only JPG, PNG, or WebP images are allowed' }
  }

  const sniffed = sniffImageType(bytes)
  if (!sniffed) return { ok: false, reason: 'File content is not a supported image' }
  // Declared type must match actual content - rejects renamed/polyglot files.
  if (sniffed !== declaredType) {
    return { ok: false, reason: 'File content does not match its declared type' }
  }

  return { ok: true, mimeType: sniffed, extension: ALLOWED_IMAGE_TYPES[sniffed] }
}
