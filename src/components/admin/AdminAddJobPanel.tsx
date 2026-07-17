'use client'

import { useCallback, useEffect, useState, KeyboardEvent } from 'react'
import { SKILLS_BY_CATEGORY, CATEGORY_LABELS } from '@/lib/skills'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LabeledField } from '@/components/ui/labeled-field'
import type { Category } from '@/types'

const CATEGORIES: Category[] = ['dancer', 'actor', 'photographer_videographer', 'content_creator']

type HirerOption = {
  id: string
  full_name: string
  email: string
}

export function AdminAddJobPanel({ onCreated }: { onCreated?: () => void }) {
  const [hirers, setHirers] = useState<HirerOption[]>([])
  const [hirerId, setHirerId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category | ''>('')
  const [skillInput, setSkillInput] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [budget, setBudget] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadHirers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?account_type=hirer&limit=100')
      if (!res.ok) return
      const data = await res.json() as { users: HirerOption[] }
      setHirers(data.users)
    } catch {
      // Hirer list is best-effort; form still validates on submit.
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load hirer list on mount
  useEffect(() => { void loadHirers() }, [loadHirers])

  const availableSkills = category ? SKILLS_BY_CATEGORY[category] : []

  function addSkill(skill: string) {
    const s = skill.trim()
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s])
    setSkillInput('')
  }

  function removeSkill(skill: string) {
    setSkills(prev => prev.filter(s => s !== skill))
  }

  function onSkillKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hirerId || !title.trim() || !description.trim() || !category || !location.trim()) {
      setError('Hirer, title, description, category, and location are required.')
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hirer_id: hirerId,
          title,
          description,
          category,
          skills_required: skills,
          location,
          budget: budget || null,
        }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string; job?: { title: string } }
      if (!res.ok) throw new Error(body.error ?? 'Failed to create job')

      setSuccess(`"${body.job?.title ?? title}" posted.`)
      setTitle('')
      setDescription('')
      setCategory('')
      setSkills([])
      setLocation('')
      setBudget('')
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Post job on behalf of a hirer</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <LabeledField label="Hirer account">
            <select
              required
              aria-label="Select hirer"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={hirerId}
              onChange={e => setHirerId(e.target.value)}
            >
              <option value="">Select hirer…</option>
              {hirers.map(hirer => (
                <option key={hirer.id} value={hirer.id}>
                  {hirer.full_name} ({hirer.email})
                </option>
              ))}
            </select>
          </LabeledField>

          <LabeledField label="Job title">
            <Input
              required
              placeholder="e.g. Bollywood dancers for music video"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </LabeledField>

          <LabeledField label="Description">
            <Textarea
              required
              className="min-h-[100px] resize-none"
              placeholder="Describe the role, shoot dates, expectations..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </LabeledField>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <Button
                  key={cat}
                  type="button"
                  size="sm"
                  variant={category === cat ? 'default' : 'outline'}
                  onClick={() => { setCategory(cat); setSkills([]) }}
                >
                  {CATEGORY_LABELS[cat]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">Required skills</label>
            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {skills.map(skill => (
                  <Badge key={skill} variant="secondary" className="gap-1 text-xs">
                    {skill}
                    <button type="button" className="ml-0.5 active:opacity-60" onClick={() => removeSkill(skill)}>✕</button>
                  </Badge>
                ))}
              </div>
            ) : null}
            {category ? (
              <select
                aria-label="Pick a skill"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value=""
                onChange={e => { if (e.target.value) addSkill(e.target.value) }}
              >
                <option value="">Pick a skill…</option>
                {availableSkills.filter(skill => !skills.includes(skill)).map(skill => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-muted-foreground">Select a category first</p>
            )}
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Or type a custom skill + Enter"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={onSkillKeyDown}
              />
              <Button type="button" variant="outline" onClick={() => addSkill(skillInput)} disabled={!skillInput.trim()}>
                Add
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledField label="Location">
              <Input
                required
                placeholder="e.g. London, UK"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </LabeledField>
            <LabeledField label="Budget (optional)">
              <Input
                placeholder="e.g. £500/day"
                value={budget}
                onChange={e => setBudget(e.target.value)}
              />
            </LabeledField>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-muted-foreground">{success}</p> : null}

          <Button type="submit" disabled={busy}>
            {busy ? 'Posting…' : 'Post job'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
