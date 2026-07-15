'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, PROFICIENCY_LABELS } from '@/lib/skills'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LabeledField } from '@/components/ui/labeled-field'
import type { TalentSkill, Category, Proficiency } from '@/types'

interface SkillsEditorProps {
  profileId: string
  skills: TalentSkill[]
  onUpdate: (skills: TalentSkill[]) => void
  onError: (error: string | null) => void
}

const CATEGORY_OPTIONS: Array<{ value: Category | ''; label: string }> = [
  { value: '', label: 'Select category...' },
  { value: 'dancer', label: CATEGORY_LABELS.dancer },
  { value: 'actor', label: CATEGORY_LABELS.actor },
  { value: 'photographer_videographer', label: CATEGORY_LABELS.photographer_videographer },
  { value: 'content_creator', label: CATEGORY_LABELS.content_creator },
]

export function SkillsEditor({ profileId, skills, onUpdate, onError }: SkillsEditorProps) {
  const [newSkillCategory, setNewSkillCategory] = useState<Category>('dancer')
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillProficiency, setNewSkillProficiency] = useState<Proficiency>('intermediate')

  async function addSkill() {
    if (!newSkillName.trim()) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('talent_skills')
      .insert({ profile_id: profileId, category: newSkillCategory, skill: newSkillName.trim(), proficiency: newSkillProficiency })
      .select().single()

    if (error) { onError(error.message); return }
    onUpdate([...skills, data as TalentSkill])
    setNewSkillName('')
    onError(null)
  }

  async function removeSkill(skillId: string) {
    if (!window.confirm('Remove this skill?')) return
    const supabase = createClient()
    const { error } = await supabase.from('talent_skills').delete().eq('id', skillId)
    if (error) { onError(error.message); return }
    onUpdate(skills.filter(s => s.id !== skillId))
    onError(null)
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <h2 className="text-sm font-semibold">Skills</h2>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skills.map(skill => (
              <Badge key={skill.id} variant="secondary" className="gap-1 text-xs">
                {skill.skill} ({PROFICIENCY_LABELS[skill.proficiency]})
                <button onClick={() => removeSkill(skill.id)} className="hover:text-foreground ml-0.5">✕</button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <LabeledField label="Category" className="flex-1">
            <select
              value={newSkillCategory}
              onChange={e => setNewSkillCategory(e.target.value as Category)}
              className="w-full bg-background border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Proficiency" className="w-32">
            <select
              value={newSkillProficiency}
              onChange={e => setNewSkillProficiency(e.target.value as Proficiency)}
              className="w-full bg-background border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {(['beginner', 'intermediate', 'advanced', 'expert'] as Proficiency[]).map(p => (
                <option key={p} value={p}>{PROFICIENCY_LABELS[p]}</option>
              ))}
            </select>
          </LabeledField>
        </div>
        <div className="flex items-end gap-2">
          <LabeledField label="Skill name" className="flex-1">
            <Input
              value={newSkillName}
              onChange={e => setNewSkillName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
              placeholder="Skill name (e.g. Hip Hop)"
            />
          </LabeledField>
          <Button variant="outline" onClick={addSkill} disabled={!newSkillName.trim()}>Add</Button>
        </div>
      </CardContent>
    </Card>
  )
}
