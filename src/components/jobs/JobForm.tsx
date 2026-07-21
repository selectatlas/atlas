'use client'

import { useState, type KeyboardEvent } from 'react'
import { SKILLS_BY_CATEGORY, CATEGORY_LABELS } from '@/lib/skills'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LabeledField } from '@/components/ui/labeled-field'
import { Switch } from '@/components/ui/switch'
import type { Category, JobWorkType } from '@/types'

const CATEGORIES: Category[] = ['dancer', 'actor', 'photographer_videographer', 'content_creator']
const WORK_TYPES: { value: JobWorkType; label: string }[] = [
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
]

export interface JobFormValues {
  title: string
  description: string
  category: Category | ''
  skills: string[]
  location: string
  budget: string
  workType: JobWorkType | ''
  startDate: string
  endDate: string
  applicationDeadline: string
  duration: string
  usageRights: string
  travelRequired: boolean
}

export const EMPTY_JOB_FORM: JobFormValues = {
  title: '',
  description: '',
  category: '',
  skills: [],
  location: '',
  budget: '',
  workType: '',
  startDate: '',
  endDate: '',
  applicationDeadline: '',
  duration: '',
  usageRights: '',
  travelRequired: false,
}

export interface JobFormProps {
  values: JobFormValues
  onChange: (values: JobFormValues) => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
  submitLabel?: string
}

export function JobForm({ values, onChange, onSubmit, submitting, error, submitLabel = 'Post job' }: JobFormProps) {
  const [skillInput, setSkillInput] = useState('')

  function set<K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) {
    onChange({ ...values, [key]: value })
  }

  const availableSkills = values.category ? SKILLS_BY_CATEGORY[values.category] : []

  function addSkill(skill: string) {
    const trimmed = skill.trim()
    if (trimmed && !values.skills.includes(trimmed)) set('skills', [...values.skills, trimmed])
    setSkillInput('')
  }

  function removeSkill(skill: string) {
    set('skills', values.skills.filter(s => s !== skill))
  }

  function onSkillKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Title + Description */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <LabeledField label="Job title">
            <Input
              placeholder="e.g. Bollywood dancers for music video"
              value={values.title}
              onChange={e => set('title', e.target.value)}
            />
          </LabeledField>
          <LabeledField label="Description">
            <Textarea
              className="min-h-[100px] resize-none"
              placeholder="Describe the role, shoot dates, expectations..."
              value={values.description}
              onChange={e => set('description', e.target.value)}
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
              <Button
                key={cat}
                type="button"
                variant="outline"
                onClick={() => onChange({ ...values, category: cat, skills: [] })}
                className={`rounded-full ${values.category === cat ? 'bg-foreground text-background hover:bg-foreground/90' : ''}`}
              >
                {CATEGORY_LABELS[cat]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Required skills */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">Required skills</label>

          {values.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {values.skills.map(s => (
                <Badge key={s} variant="secondary" className="gap-1 text-xs">
                  {s}
                  <Button type="button" variant="ghost" size="icon-xs" className="ml-0.5 size-auto p-0 hover:bg-transparent" onClick={() => removeSkill(s)}>✕</Button>
                </Badge>
              ))}
            </div>
          )}

          {values.category ? (
            <div className="flex gap-2">
              <select
                aria-label="Pick a skill"
                className="w-full bg-background border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value=""
                onChange={e => { if (e.target.value) addSkill(e.target.value) }}
              >
                <option value="">Pick a skill...</option>
                {availableSkills.filter(s => !values.skills.includes(s)).map(s => (
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
              value={values.location}
              onChange={e => set('location', e.target.value)}
            />
          </LabeledField>
          <LabeledField label={<>Budget <span className="text-muted-foreground/50">(optional)</span></>}>
            <Input
              placeholder="e.g. £500/day or negotiable"
              value={values.budget}
              onChange={e => set('budget', e.target.value)}
            />
          </LabeledField>
        </CardContent>
      </Card>

      {/* Logistics — feeds the action card talent sees on the job brief */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-3">Work type <span className="text-muted-foreground/50">(optional)</span></label>
            <div className="flex flex-wrap gap-2">
              {WORK_TYPES.map(wt => (
                <Button
                  key={wt.value}
                  type="button"
                  variant="outline"
                  onClick={() => set('workType', values.workType === wt.value ? '' : wt.value)}
                  className={`rounded-full ${values.workType === wt.value ? 'bg-foreground text-background hover:bg-foreground/90' : ''}`}
                >
                  {wt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledField label={<>Start date <span className="text-muted-foreground/50">(optional)</span></>}>
              <Input type="date" value={values.startDate} onChange={e => set('startDate', e.target.value)} />
            </LabeledField>
            <LabeledField label={<>End date <span className="text-muted-foreground/50">(optional)</span></>}>
              <Input type="date" value={values.endDate} onChange={e => set('endDate', e.target.value)} />
            </LabeledField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledField label={<>Apply by <span className="text-muted-foreground/50">(optional)</span></>}>
              <Input type="date" value={values.applicationDeadline} onChange={e => set('applicationDeadline', e.target.value)} />
            </LabeledField>
            <LabeledField label={<>Duration <span className="text-muted-foreground/50">(optional)</span></>}>
              <Input
                placeholder="e.g. 2 rehearsal weeks + 12 tour dates"
                value={values.duration}
                onChange={e => set('duration', e.target.value)}
              />
            </LabeledField>
          </div>

          <LabeledField label={<>Usage rights <span className="text-muted-foreground/50">(optional)</span></>}>
            <Input
              placeholder="e.g. Tour visuals + social coverage, 18 months"
              value={values.usageRights}
              onChange={e => set('usageRights', e.target.value)}
            />
          </LabeledField>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Travel required</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Shown to talent on the job brief</p>
            </div>
            <Switch checked={values.travelRequired} onCheckedChange={checked => set('travelRequired', checked)} />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={onSubmit}
          disabled={submitting}
          className="h-12 rounded-2xl bg-accent px-8 font-semibold text-accent-foreground hover:bg-accent/80"
        >
          {submitting ? 'Posting...' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
