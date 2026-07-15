'use client'

import { useEffect, useState, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { SKILLS_BY_CATEGORY, CATEGORY_LABELS } from '@/lib/skills'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LabeledField } from '@/components/ui/labeled-field'
import type { Category } from '@/types'

const CATEGORIES: Category[] = ['dancer', 'actor', 'photographer_videographer', 'content_creator']

export default function NewJobPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category | ''>('')
  const [skillInput, setSkillInput] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [budget, setBudget] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultsLoaded, setDefaultsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadDefaults() {
      if (isLocalDemoMode()) {
        if (!cancelled) setDefaultsLoaded(true)
        return
      }
      try {
        const response = await fetch('/api/me/settings')
        if (!response.ok || cancelled) {
          if (!cancelled) setDefaultsLoaded(true)
          return
        }
        const data = await response.json()
        if (cancelled) return
        if (data.job_defaults?.category) setCategory(prev => prev || data.job_defaults.category)
        if (Array.isArray(data.job_defaults?.skills_required)) {
          setSkills(prev => prev.length > 0 ? prev : data.job_defaults.skills_required)
        }
        if (data.job_defaults?.location) setLocation(prev => prev || data.job_defaults.location)
        if (data.job_defaults?.budget) setBudget(prev => prev || data.job_defaults.budget)
      } catch {
        // Prefill is best-effort; the form still works empty.
      } finally {
        if (!cancelled) setDefaultsLoaded(true)
      }
    }
    void loadDefaults()
    return () => { cancelled = true }
  }, [])

  const availableSkills = category ? SKILLS_BY_CATEGORY[category as Category] : []

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

  async function handleSubmit() {
    if (!title.trim() || !description.trim() || !category || !location.trim()) {
      setError('Title, description, category, and location are required.')
      return
    }
    setPosting(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, category, skills_required: skills, location, budget }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to post job'); return }
      router.push('/jobs')
    } catch {
      setError('Network error')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Post a job</h1>
          {defaultsLoaded && (category || location || budget || skills.length > 0) && (
            <p className="text-xs text-muted-foreground">Prefills from your workspace settings</p>
          )}
        </div>
      </div>

      {error && (
        <p className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Title + Description */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <LabeledField label="Job title">
            <Input
              placeholder="e.g. Bollywood dancers for music video"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </LabeledField>
          <LabeledField label="Description">
            <Textarea
              className="min-h-[100px] resize-none"
              placeholder="Describe the role, shoot dates, expectations..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </LabeledField>
        </CardContent>
      </Card>

      {/* Category */}
      <Card>
        <CardContent className="p-5">
          <label className="block text-xs font-medium text-muted-foreground mb-3">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setSkills([]) }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  category === cat
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Required skills */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">Required skills</label>

          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {skills.map(s => (
                <Badge key={s} variant="secondary" className="gap-1 text-xs">
                  {s}
                  <button onClick={() => removeSkill(s)} className="hover:text-foreground ml-0.5">✕</button>
                </Badge>
              ))}
            </div>
          )}

          {category ? (
            <div className="flex gap-2">
              <select
                aria-label="Pick a skill"
                className="w-full bg-background border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value=""
                onChange={e => { if (e.target.value) addSkill(e.target.value) }}
              >
                <option value="">Pick a skill...</option>
                {availableSkills.filter(s => !skills.includes(s)).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">Select a category first</p>
          )}

          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder="Or type a custom skill + Enter"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={onSkillKeyDown}
            />
            <Button
              variant="outline"
              onClick={() => addSkill(skillInput)}
              disabled={!skillInput.trim()}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Location + Budget */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <LabeledField label="Location">
            <Input
              placeholder="e.g. London, UK"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </LabeledField>
          <LabeledField label={<>Budget <span className="text-muted-foreground/50">(optional)</span></>}>
            <Input
              placeholder="e.g. £500/day or negotiable"
              value={budget}
              onChange={e => setBudget(e.target.value)}
            />
          </LabeledField>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSubmit}
          disabled={posting}
          className="h-12 rounded-2xl bg-accent px-8 font-semibold text-accent-foreground hover:bg-accent/80"
        >
          {posting ? 'Posting...' : 'Post job'}
        </Button>
      </div>
    </div>
  )
}
