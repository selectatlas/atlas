'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface PhotoUploadProps {
  currentUrl: string | null
  initials: string
  onUploaded: (url: string) => void
  bucket?: 'avatars' | 'covers'
}

// Convenience pre-check only - the server route re-verifies type, size, and
// actual file content before anything reaches storage.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function PhotoUpload({ currentUrl, initials, onUploaded, bucket = 'avatars' }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please select a JPG, PNG, or WebP image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }

    setError(null)
    setUploading(true)

    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    try {
      const formData = new FormData()
      formData.append('bucket', bucket)
      formData.append('file', file)

      const response = await fetch('/api/uploads/profile-photo', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.url) {
        throw new Error(data?.error ?? 'Upload failed')
      }

      onUploaded(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setPreview(null)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const displayUrl = preview ?? currentUrl

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="relative size-20 overflow-hidden rounded-2xl border-2 border-dashed bg-muted p-0 hover:border-primary disabled:opacity-60"
        aria-label="Upload profile photo"
      >
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt="Profile photo"
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
            {initials}
          </div>
        )}

        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/50 transition-colors flex items-center justify-center">
          {uploading ? (
            <div className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-foreground opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
          )}
        </div>
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />

      <p className="text-muted-foreground text-xs">Tap to upload photo (max 5MB)</p>

      {error && (
        <p className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-1.5">{error}</p>
      )}
    </div>
  )
}
