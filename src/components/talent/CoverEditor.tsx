'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PhotoUpload } from '@/components/talent/PhotoUpload'
import { Button } from '@/components/ui/button'
import type { CoverLayout } from '@/types'

const GRID_TILES = 3

interface CoverEditorProps {
  profileId: string
  initials: string
  coverUrl: string | null
  coverImages: string[]
  layout: CoverLayout
  onChange: (patch: { cover_url?: string; cover_images?: string[]; cover_layout?: CoverLayout }) => void
  onError: (error: string | null) => void
}

export function CoverEditor({
  profileId,
  initials,
  coverUrl,
  coverImages,
  layout,
  onChange,
  onError,
}: CoverEditorProps) {
  // Fixed-length slots so a talent can fill the middle tile first; only the
  // filled ones are persisted.
  const [slots, setSlots] = useState<Array<string | null>>(() =>
    Array.from({ length: GRID_TILES }, (_, i) => coverImages[i] ?? null)
  )
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const targetSlot = useRef<number>(0)

  async function persist(next: Array<string | null>) {
    setSlots(next)
    const images = next.filter((url): url is string => Boolean(url))
    onChange({ cover_images: images })
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ cover_images: images })
      .eq('id', profileId)
    if (error) onError(error.message)
  }

  async function setLayout(next: CoverLayout) {
    onChange({ cover_layout: next })
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ cover_layout: next })
      .eq('id', profileId)
    if (error) onError(error.message)
  }

  async function uploadToSlot(file: File) {
    const slot = targetSlot.current
    setUploadingSlot(slot)
    onError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      // Deliberately the portfolio route, not profile-photo: that one wipes
      // every other file in the caller's folder after each upload, which is
      // right for a single avatar or cover and would delete the other two
      // tiles here.
      const res = await fetch('/api/uploads/portfolio-image', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) {
        onError(data.error ?? 'Upload failed')
        return
      }
      const next = [...slots]
      next[slot] = data.url
      await persist(next)
    } catch {
      onError('Upload failed. Check your connection and try again.')
    } finally {
      setUploadingSlot(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const filled = slots.filter(Boolean).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Cover</h2>
        <div className="flex gap-1">
          <Button
            type="button"
            size="xs"
            variant={layout === 'single' ? 'default' : 'outline'}
            onClick={() => setLayout('single')}
          >
            Single photo
          </Button>
          <Button
            type="button"
            size="xs"
            variant={layout === 'grid' ? 'default' : 'outline'}
            onClick={() => setLayout('grid')}
          >
            Photo grid
          </Button>
        </div>
      </div>

      {layout === 'single' ? (
        <PhotoUpload
          variant="cover"
          bucket="covers"
          currentUrl={coverUrl}
          initials={initials}
          onUploaded={async (url) => {
            onChange({ cover_url: url })
            const supabase = createClient()
            await supabase.from('profiles').update({ cover_url: url }).eq('id', profileId)
          }}
        />
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Upload cover photo"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) void uploadToSlot(file)
            }}
          />
          <div className="grid grid-cols-3 gap-2">
            {slots.map((url, slot) => (
              <div
                key={slot}
                className="relative aspect-square overflow-hidden rounded-xl border border-dashed bg-muted"
              >
                {url ? (
                  <>
                    <Image src={url} alt="" fill className="object-cover" sizes="120px" />
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="secondary"
                      aria-label={`Remove cover photo ${slot + 1}`}
                      className="absolute right-1 top-1 rounded-full"
                      onClick={() => void persist(slots.map((s, i) => (i === slot ? null : s)))}
                    >
                      <X className="size-3" />
                    </Button>
                  </>
                ) : (
                  <button
                    type="button"
                    aria-label={`Add cover photo ${slot + 1}`}
                    disabled={uploadingSlot !== null}
                    onClick={() => {
                      targetSlot.current = slot
                      inputRef.current?.click()
                    }}
                    className="flex size-full cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    {uploadingSlot === slot ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <Plus className="size-5" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {filled === GRID_TILES
              ? 'JPG, PNG or WebP · max 5MB each'
              : `Add ${GRID_TILES - filled} more photo${GRID_TILES - filled === 1 ? '' : 's'} to use the grid — until then your single cover photo shows.`}
          </p>
        </>
      )}
    </div>
  )
}
