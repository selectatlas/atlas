'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import type { PortfolioItem } from '@/types'

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

export function PortfolioEditor({ profileId, items, onUpdate, onError }: PortfolioEditorProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    type: 'video' as PortfolioItem['type'], url: '', title: '', description: '', thumbnail_url: '',
  })

  function resetForm() {
    setForm({ type: 'video', url: '', title: '', description: '', thumbnail_url: '' })
    setShowForm(false)
  }

  async function saveItem() {
    if (!form.url.trim()) return
    const supabase = createClient()
    const { error: err } = await supabase.from('portfolio_items').insert({
      profile_id: profileId, type: form.type, url: form.url.trim(),
      title: form.title.trim() || null, description: form.description.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null, sort_order: items.length,
    })
    if (err) { onError(err.message); return }
    resetForm()
    onUpdate()
    onError(null)
  }

  async function deleteItem(itemId: string) {
    if (!window.confirm('Delete this portfolio item?')) return
    const supabase = createClient()
    const { error: err } = await supabase.from('portfolio_items').delete().eq('id', itemId)
    if (err) { onError(err.message); return }
    onUpdate()
    onError(null)
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Portfolio</h2>
          {!showForm && (
            <Button variant="link" onClick={() => setShowForm(true)} className="text-primary h-auto p-0">
              + Add item
            </Button>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.title || item.url}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{item.type}</p>
                </div>
                <button onClick={() => deleteItem(item.id)} className="text-xs text-destructive hover:underline ml-3">✕</button>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="space-y-3 border-t pt-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as PortfolioItem['type'] }))}
                className="w-full bg-background border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {MEDIA_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">URL</label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://youtube.com/..." />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={saveItem} className="bg-accent text-accent-foreground hover:bg-accent/80 rounded-xl font-semibold">
                Add
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
