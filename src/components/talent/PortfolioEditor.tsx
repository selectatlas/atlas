'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowUp, ArrowDown, Film, Upload, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { storagePathFromUrl } from '@/lib/portfolio-media'
import { resolveVideoSource } from '@/lib/video-embed'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import type { PortfolioItem } from '@/types'

const OUTCOME_MAX_LENGTH = 280
const ROLE_MAX_LENGTH = 80
const TITLE_MAX_LENGTH = 120
const DESCRIPTION_MAX_LENGTH = 500

interface PortfolioEditorProps {
  profileId: string
  items: PortfolioItem[]
  onUpdate: () => void
  onError: (error: string | null) => void
}

const MEDIA_TYPE_OPTIONS: Array<{ value: PortfolioItem['type']; label: string }> = [
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
  { value: 'link', label: 'Link' },
]

const EMPTY_FORM = {
  type: 'video' as PortfolioItem['type'],
  url: '',
  title: '',
  description: '',
  thumbnail_url: '',
  role: '',
  project_date: '',
  outcome: '',
}

type FormState = typeof EMPTY_FORM

export function PortfolioEditor({ profileId, items, onUpdate, onError }: PortfolioEditorProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  function editItem(item: PortfolioItem) {
    setForm({
      type: item.type,
      url: item.url,
      title: item.title ?? '',
      description: item.description ?? '',
      thumbnail_url: item.thumbnail_url ?? '',
      role: item.role ?? '',
      project_date: item.project_date ?? '',
      outcome: item.outcome ?? '',
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  // Uploaded media becomes portfolio items immediately - making someone fill
  // in a form before their photos appear is the slowest possible way to build
  // a portfolio. Details are editable afterwards.
  //
  // Videos go to their own route: same bucket and same uid-scoped folder, but
  // a 100MB ceiling and container sniffing instead of image magic bytes.
  async function uploadFiles(files: FileList, kind: 'image' | 'video') {
    setUploading(true)
    onError(null)
    const supabase = createClient()
    const endpoint = kind === 'video' ? 'portfolio-video' : 'portfolio-image'
    const inputRef = kind === 'video' ? videoInputRef : fileInputRef
    let sortOrder = items.length
    let failures = 0

    for (const file of Array.from(files)) {
      try {
        const body = new FormData()
        body.append('file', file)
        const res = await fetch(`/api/uploads/${endpoint}`, { method: 'POST', body })
        const data = await res.json()
        if (!res.ok) { failures += 1; onError(data.error ?? 'Upload failed'); continue }

        const { error: err } = await supabase.from('portfolio_items').insert({
          profile_id: profileId,
          type: kind,
          url: data.url,
          title: file.name.replace(/\.[^.]+$/, '').slice(0, TITLE_MAX_LENGTH) || null,
          sort_order: sortOrder,
        })
        if (err) { failures += 1; onError(err.message); continue }
        sortOrder += 1
      } catch {
        failures += 1
        onError('Upload failed. Check your connection and try again.')
      }
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    onUpdate()
    if (failures === 0) onError(null)
  }

  async function saveItem() {
    if (!form.url.trim()) return
    const supabase = createClient()
    const payload = {
      profile_id: profileId,
      type: form.type,
      url: form.url.trim(),
      title: form.title.trim().slice(0, TITLE_MAX_LENGTH) || null,
      description: form.description.trim().slice(0, DESCRIPTION_MAX_LENGTH) || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      role: form.role.trim().slice(0, ROLE_MAX_LENGTH) || null,
      project_date: form.project_date || null,
      outcome: form.outcome.trim().slice(0, OUTCOME_MAX_LENGTH) || null,
    }

    if (editingId) {
      const { error: err } = await supabase.from('portfolio_items').update(payload).eq('id', editingId)
      if (err) { onError(err.message); return }
    } else {
      const { error: err } = await supabase
        .from('portfolio_items')
        .insert({ ...payload, sort_order: items.length })
      if (err) { onError(err.message); return }
    }

    resetForm()
    onUpdate()
    onError(null)
  }

  async function deleteItem(item: PortfolioItem) {
    if (!window.confirm('Delete this portfolio item?')) return
    setBusyId(item.id)
    const supabase = createClient()
    const { error: err } = await supabase.from('portfolio_items').delete().eq('id', item.id)
    if (err) { setBusyId(null); onError(err.message); return }

    // Best-effort: drop the stored file too so deleted work does not linger.
    const path = storagePathFromUrl(item.url)
    if (path) {
      try {
        await fetch(`/api/uploads/portfolio-image?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
      } catch {
        // The row is gone; an orphaned object is not worth failing the action.
      }
    }

    setBusyId(null)
    onUpdate()
    onError(null)
  }

  // Swaps sort_order with the neighbour. Two writes rather than renumbering
  // the whole list, so a failure cannot leave a half-renumbered portfolio.
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const current = items[index]
    const neighbour = items[target]
    setBusyId(current.id)
    const supabase = createClient()

    const [a, b] = await Promise.all([
      supabase.from('portfolio_items').update({ sort_order: neighbour.sort_order }).eq('id', current.id),
      supabase.from('portfolio_items').update({ sort_order: current.sort_order }).eq('id', neighbour.id),
    ])

    setBusyId(null)
    if (a.error || b.error) { onError((a.error ?? b.error)!.message); return }
    onUpdate()
    onError(null)
  }

  const isImageForm = form.type === 'image'
  const urlIsBlocked = resolveVideoSource(form.url.trim())?.kind === 'blocked'

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Portfolio</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Upload photos and video, or paste a YouTube, Vimeo or TikTok link. Order sets
              how hirers see them.
            </p>
          </div>
          {!showForm && (
            <Button variant="link" onClick={() => { setShowForm(true); setEditingId(null) }} className="text-primary h-auto shrink-0 p-0">
              + Add link
            </Button>
          )}
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            aria-label="Upload portfolio photos"
            onChange={e => { if (e.target.files?.length) void uploadFiles(e.target.files, 'image') }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            multiple
            className="sr-only"
            aria-label="Upload portfolio videos"
            onChange={e => { if (e.target.files?.length) void uploadFiles(e.target.files, 'video') }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-center gap-2 border-dashed py-6"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? 'Uploading…' : 'Upload photos'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-center gap-2 border-dashed py-6"
              disabled={uploading}
              onClick={() => videoInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
              {uploading ? 'Uploading…' : 'Upload video'}
            </Button>
          </div>
          <p className="text-muted-foreground mt-1.5 text-[11px]">
            Photos: JPG, PNG or WebP · max 5MB each. Video: MP4, WebM or MOV · max 100MB each.
          </p>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={item.id} className="bg-muted flex items-center gap-3 rounded-xl px-3 py-2.5">
                <div className="bg-background relative size-11 shrink-0 overflow-hidden rounded-lg">
                  {(item.type === 'image' || item.thumbnail_url) ? (
                    <Image
                      src={item.thumbnail_url ?? item.url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  ) : (
                    <span className="text-muted-foreground flex size-full items-center justify-center text-[10px] uppercase">
                      {item.type}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title || item.url}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {item.role ? `${item.role} · ` : ''}{item.type}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${item.title || 'item'} up`}
                    disabled={index === 0 || busyId !== null}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${item.title || 'item'} down`}
                    disabled={index === items.length - 1 || busyId !== null}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button type="button" variant="link" size="xs" className="h-auto p-0 px-1.5" onClick={() => editItem(item)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="text-destructive h-auto p-0"
                    disabled={busyId === item.id}
                    onClick={() => deleteItem(item)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="space-y-3 border-t pt-4">
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as PortfolioItem['type'] }))}
                className="bg-background focus:ring-ring w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              >
                {MEDIA_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium">URL</label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://youtube.com/..." />
              {/* Instagram sends X-Frame-Options: DENY, so a pasted reel can
                  never play inside Atlas. Say so at the point of pasting and
                  offer the one route that does work, rather than letting the
                  talent discover a dead player on their public profile. */}
              {urlIsBlocked && (
                <div className="mt-2 space-y-2 rounded-xl border border-warning/30 bg-warning/10 p-3">
                  <p className="text-xs font-medium">Instagram won&apos;t play inside Atlas</p>
                  <p className="text-muted-foreground text-xs">
                    Instagram blocks other sites from playing its posts. Upload the video file
                    instead and hirers can watch it here without leaving your profile.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => videoInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    <Film className="size-3.5" />
                    Upload the video instead
                  </Button>
                </div>
              )}
            </div>
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Title</label>
              <Input value={form.title} maxLength={TITLE_MAX_LENGTH} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Performance showreel 2026" />
            </div>
            {!isImageForm && (
              <div>
                <label className="text-muted-foreground mb-1.5 block text-xs font-medium">
                  Thumbnail URL <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <Input value={form.thumbnail_url} onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))} placeholder="https://…" />
                <p className="text-muted-foreground mt-1 text-[11px]">Used as the preview image on your profile and search cards.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Your role</label>
                <Input value={form.role} maxLength={ROLE_MAX_LENGTH} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Lead dancer" />
              </div>
              <div>
                <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Project date</label>
                <Input type="date" value={form.project_date} onChange={e => setForm(f => ({ ...f, project_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium">
                Description <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Textarea
                value={form.description}
                maxLength={DESCRIPTION_MAX_LENGTH}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What was the brief, and what did you do?"
                rows={2}
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Outcome</label>
              <Textarea
                value={form.outcome}
                maxLength={OUTCOME_MAX_LENGTH}
                onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
                placeholder="What did this project achieve? e.g. '2M views across campaign channels'"
                rows={2}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={saveItem} className="bg-accent text-accent-foreground hover:bg-accent/80 rounded-xl font-semibold">
                {editingId ? 'Update' : 'Add'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
