import { describe, it, expect } from 'vitest'
import { sniffImageType, verifyImage, MAX_IMAGE_BYTES } from './image-verification'

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
const HTML_BYTES = new TextEncoder().encode('<!doctype html><script>alert(1)</script>')

describe('sniffImageType', () => {
  it('identifies JPEG, PNG, and WebP signatures', () => {
    expect(sniffImageType(JPEG_BYTES)).toBe('image/jpeg')
    expect(sniffImageType(PNG_BYTES)).toBe('image/png')
    expect(sniffImageType(WEBP_BYTES)).toBe('image/webp')
  })

  it('returns null for non-image content', () => {
    expect(sniffImageType(HTML_BYTES)).toBeNull()
    expect(sniffImageType(new Uint8Array([]))).toBeNull()
    // RIFF but not WEBP (e.g. a WAV file)
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull()
  })
})

describe('verifyImage', () => {
  it('accepts content matching its declared type', () => {
    const result = verifyImage(PNG_BYTES, 'image/png')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.extension).toBe('png')
  })

  it('rejects a polyglot: content not matching the declared type', () => {
    // HTML uploaded with an image MIME type
    expect(verifyImage(HTML_BYTES, 'image/png').ok).toBe(false)
    // Real PNG declared as JPEG (renamed file)
    expect(verifyImage(PNG_BYTES, 'image/jpeg').ok).toBe(false)
  })

  it('rejects disallowed declared types even with image content', () => {
    expect(verifyImage(JPEG_BYTES, 'image/svg+xml').ok).toBe(false)
    expect(verifyImage(JPEG_BYTES, 'application/octet-stream').ok).toBe(false)
  })

  it('rejects empty and oversized files', () => {
    expect(verifyImage(new Uint8Array([]), 'image/png').ok).toBe(false)
    const oversized = new Uint8Array(MAX_IMAGE_BYTES + 1)
    oversized.set([0xff, 0xd8, 0xff])
    expect(verifyImage(oversized, 'image/jpeg').ok).toBe(false)
  })
})
