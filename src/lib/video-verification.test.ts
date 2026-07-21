import { describe, expect, it } from 'vitest'
import {
  MAX_VIDEO_BYTES,
  sniffVideoType,
  verifyVideo,
} from '@/lib/video-verification'

function bytesFrom(head: number[], length = 64): Uint8Array {
  const out = new Uint8Array(length)
  out.set(head, 0)
  return out
}

function isoBaseMedia(brand: string): Uint8Array {
  const ascii = (text: string) => [...text].map(c => c.charCodeAt(0))
  return bytesFrom([0, 0, 0, 0x20, ...ascii('ftyp'), ...ascii(brand)])
}

const WEBM = bytesFrom([0x1a, 0x45, 0xdf, 0xa3])
const MP4 = isoBaseMedia('isom')
const MOV = isoBaseMedia('qt  ')

describe('sniffVideoType', () => {
  it('detects WebM from its EBML header', () => {
    expect(sniffVideoType(WEBM)).toBe('video/webm')
  })

  it('detects MP4 across its common major brands', () => {
    for (const brand of ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ']) {
      expect(sniffVideoType(isoBaseMedia(brand))).toBe('video/mp4')
    }
  })

  it('separates QuickTime from MP4 by major brand', () => {
    expect(sniffVideoType(MOV)).toBe('video/quicktime')
  })

  it('returns null for non-video content', () => {
    // A JPEG, a PNG, and a truncated file.
    expect(sniffVideoType(bytesFrom([0xff, 0xd8, 0xff]))).toBeNull()
    expect(sniffVideoType(bytesFrom([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
    expect(sniffVideoType(new Uint8Array([0x1a, 0x45]))).toBeNull()
  })

  it('rejects containers browsers cannot decode natively', () => {
    // Matroska-adjacent but not WebM, and an AVI RIFF header.
    const ascii = (t: string) => [...t].map(c => c.charCodeAt(0))
    expect(sniffVideoType(bytesFrom(ascii('RIFF')))).toBeNull()
    expect(sniffVideoType(isoBaseMedia('avif'))).toBeNull()
  })
})

describe('verifyVideo', () => {
  it('accepts a well-formed video whose bytes match its declared type', () => {
    expect(verifyVideo(MP4, 'video/mp4')).toEqual({
      ok: true,
      mimeType: 'video/mp4',
      extension: 'mp4',
    })
    expect(verifyVideo(WEBM, 'video/webm')).toEqual({
      ok: true,
      mimeType: 'video/webm',
      extension: 'webm',
    })
  })

  it('treats MP4 and QuickTime as interchangeable, since they share a container', () => {
    expect(verifyVideo(MOV, 'video/mp4')).toMatchObject({ ok: true })
    expect(verifyVideo(MP4, 'video/quicktime')).toMatchObject({ ok: true })
  })

  it('rejects a renamed file whose content does not match its declared type', () => {
    // An image the browser claims is an MP4 - the attack magic bytes catch.
    expect(verifyVideo(bytesFrom([0xff, 0xd8, 0xff]), 'video/mp4')).toEqual({
      ok: false,
      reason: 'File content is not a supported video',
    })
    expect(verifyVideo(WEBM, 'video/mp4')).toEqual({
      ok: false,
      reason: 'File content does not match its declared type',
    })
  })

  it('rejects disallowed declared types outright', () => {
    expect(verifyVideo(MP4, 'video/x-msvideo')).toMatchObject({ ok: false })
    expect(verifyVideo(MP4, 'image/png')).toMatchObject({ ok: false })
  })

  it('rejects empty and oversized files', () => {
    expect(verifyVideo(new Uint8Array(0), 'video/mp4')).toEqual({
      ok: false,
      reason: 'File is empty',
    })
    const oversized = new Uint8Array(MAX_VIDEO_BYTES + 1)
    oversized.set(MP4.subarray(0, 12), 0)
    expect(verifyVideo(oversized, 'video/mp4')).toEqual({
      ok: false,
      reason: 'Video must be under 100MB',
    })
  })
})
