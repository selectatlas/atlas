'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import type { Credit } from '@/types'

interface CreditsEditorProps {
  profileId: string
  credits: Credit[]
  onUpdate: () => void
  onError: (error: string | null) => void
}

export function CreditsEditor({ profileId, credits, onUpdate, onError }: CreditsEditorProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', production: '', company: '', start_date: '', end_date: '', description: '', media_url: '', category: '',
  })

  function resetForm() {
    setForm({ title: '', production: '', company: '', start_date: '', end_date: '', description: '', media_url: '', category: '' })
    setEditingId(null)
    setShowForm(false)
  }

  function editCredit(credit: Credit) {
    setForm({
      title: credit.title, production: credit.production, company: credit.company ?? '',
      start_date: credit.start_date ?? '', end_date: credit.end_date ?? '',
      description: credit.description ?? '', media_url: credit.media_url ?? '',
      category: credit.category ?? '',
    })
    setEditingId(credit.id)
    setShowForm(true)
  }

  async function saveCredit() {
    if (!form.title.trim() || !form.production.trim()) return
    const supabase = createClient()
    const payload = {
      profile_id: profileId,
      title: form.title.trim(), production: form.production.trim(),
      company: form.company.trim() || null,
      start_date: form.start_date || null, end_date: form.end_date || null,
      description: form.description.trim() || null, media_url: form.media_url.trim() || null,
      category: form.category || null, sort_order: credits.length,
    }

    if (editingId) {
      const { error: err } = await supabase.from('credits').update(payload).eq('id', editingId)
      if (err) { onError(err.message); return }
    } else {
      const { error: err } = await supabase.from('credits').insert(payload)
      if (err) { onError(err.message); return }
    }

    resetForm()
    onUpdate()
    onError(null)
  }

  async function deleteCredit(creditId: string) {
    if (!window.confirm('Delete this credit?')) return
    const supabase = createClient()
    const { error: err } = await supabase.from('credits').delete().eq('id', creditId)
    if (err) { onError(err.message); return }
    onUpdate()
    onError(null)
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Credits & Experience</h2>
          {!showForm && (
            <Button variant="link" onClick={() => { setShowForm(true); setEditingId(null) }} className="text-primary h-auto p-0">
              + Add credit
            </Button>
          )}
        </div>

        {credits.length > 0 && (
          <div className="space-y-2">
            {credits.map(credit => (
              <div key={credit.id} className="flex items-start justify-between bg-muted rounded-xl px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{credit.title}</p>
                  <p className="text-muted-foreground text-xs mt-0.5 truncate">
                    {credit.production}{credit.company ? ` · ${credit.company}` : ''}
                  </p>
                </div>
                <div className="flex gap-1 ml-3 shrink-0">
                  <button onClick={() => editCredit(credit)} className="text-xs text-primary hover:underline">Edit</button>
                  <button onClick={() => deleteCredit(credit.id)} className="text-xs text-destructive hover:underline ml-1">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="space-y-3 border-t pt-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Title</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Lead Dancer" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Production</label>
                <Input value={form.production} onChange={e => setForm(f => ({ ...f, production: e.target.value }))} placeholder="The Nutcracker" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Company</label>
                <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Royal Ballet" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={saveCredit} className="bg-accent text-accent-foreground hover:bg-accent/80 rounded-xl font-semibold">
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
