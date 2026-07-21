// Server-side video content verification, mirroring image-verification.ts.
// Browser MIME claims are attacker-controlled, so verify actual file
// signatures before anything reaches storage.
//
// We do not transcode. Whatever is uploaded is what plays, so the allowlist is
// deliberately limited to containers every current browser decodes natively -
// an AVI or MKV would store fine and then fail silently in the player.

export const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

// Video is two orders of magnitude larger than a photo. 100MB is roughly two
// minutes of decent 1080p - enough for a real showreel without letting a
// single upload stall on venue wifi.
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((byte, i) => bytes[offset + i] === byte)
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return ''
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

/**
 * ISO base media files (MP4, MOV, M4V) all start with a `ftyp` box at offset 4.
 * The four bytes after it are the major brand, which is what separates a
 * QuickTime container from an MP4 one.
 */
function sniffIsoBaseMedia(bytes: Uint8Array): 'video/mp4' | 'video/quicktime' | null {
  if (asciiAt(bytes, 4, 4) !== 'ftyp') return null
  const brand = asciiAt(bytes, 8, 4)
  if (brand === 'qt  ') return 'video/quicktime'
  // isom/iso2/mp41/mp42/avc1/M4V /mmp4 and friends are all MP4 containers.
  if (/^(isom|iso\d|mp4\d|avc1|M4V |mmp4|dash)$/.test(brand)) return 'video/mp4'
  return null
}

// Returns the verified MIME type from file content, or null when the bytes
// are not a supported video format.
export function sniffVideoType(
  bytes: Uint8Array
): 'video/mp4' | 'video/webm' | 'video/quicktime' | null {
  // WebM/Matroska: EBML header 1A 45 DF A3
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm'
  return sniffIsoBaseMedia(bytes)
}

export type VideoVerification =
  | { ok: true; mimeType: 'video/mp4' | 'video/webm' | 'video/quicktime'; extension: string }
  | { ok: false; reason: string }

export function verifyVideo(bytes: Uint8Array, declaredType: string): VideoVerification {
  if (bytes.byteLength === 0) return { ok: false, reason: 'File is empty' }
  if (bytes.byteLength > MAX_VIDEO_BYTES) {
    return { ok: false, reason: 'Video must be under 100MB' }
  }
  if (!(declaredType in ALLOWED_VIDEO_TYPES)) {
    return { ok: false, reason: 'Only MP4, WebM, or MOV videos are allowed' }
  }

  const sniffed = sniffVideoType(bytes)
  if (!sniffed) return { ok: false, reason: 'File content is not a supported video' }
  // A .mov and a .mp4 share the ISO base container, and browsers happily play
  // a QuickTime-branded file served as video/mp4. Treat that pair as
  // interchangeable; every other mismatch is a renamed or polyglot file.
  const isoPair =
    (sniffed === 'video/quicktime' && declaredType === 'video/mp4') ||
    (sniffed === 'video/mp4' && declaredType === 'video/quicktime')
  if (sniffed !== declaredType && !isoPair) {
    return { ok: false, reason: 'File content does not match its declared type' }
  }

  return { ok: true, mimeType: sniffed, extension: ALLOWED_VIDEO_TYPES[sniffed]! }
}
