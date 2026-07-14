'use client'

import { ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { filtersForCategory, type TalentFilterDefinition } from '@/lib/filter-taxonomy'
import type { TalentAttributesPayload } from '@/lib/talent-profile-attributes'
import type { Category } from '@/types'

interface TalentAttributesEditorProps {
  category: Category | null
  value: TalentAttributesPayload
  onChange: (value: TalentAttributesPayload) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>
}

function humanise(value: string) {
  return value.replace(/_/g, ' ').replace(/^\w/, character => character.toUpperCase())
}

function listFromInput(value: string) {
  return [...new Set(value.split(',').map(item => item.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')).filter(Boolean))]
}

function displayList(values: string[], definition: TalentFilterDefinition) {
  const labels = new Map(definition.options?.map(option => [option.value, option.label]) ?? [])
  return values.map(value => labels.get(value) ?? humanise(value)).join(', ')
}

export function TalentAttributesEditor({ category, value, onChange }: TalentAttributesEditorProps) {
  const definitions = filtersForCategory(category ?? 'all').filter(definition =>
    definition.storage === 'public_attributes' || definition.storage === 'sensitive_preferences'
  )
  const sections = [...new Set(definitions.map(definition => definition.section))]

  function updateCore<K extends keyof TalentAttributesPayload>(key: K, next: TalentAttributesPayload[K]) {
    onChange({ ...value, [key]: next })
  }

  function updateAttribute(definition: TalentFilterDefinition, next: string | string[] | boolean | null) {
    const mapKey = definition.storage === 'sensitive_preferences' ? 'sensitive_preferences' : 'public_attributes'
    const map = { ...value[mapKey] } as Record<string, string | string[] | boolean | number | null>
    if (next === null || next === '' || (Array.isArray(next) && next.length === 0)) delete map[definition.key]
    else map[definition.key] = next
    onChange({ ...value, [mapKey]: map })
  }

  function currentValue(definition: TalentFilterDefinition) {
    const source = definition.storage === 'sensitive_preferences' ? value.sensitive_preferences : value.public_attributes
    return source[definition.key]
  }

  function renderAttribute(definition: TalentFilterDefinition) {
    const current = currentValue(definition)
    if (definition.dependsOn) {
      const dependency = definitions.find(item => item.key === definition.dependsOn?.key)
      if (dependency && currentValue(dependency) !== definition.dependsOn.value) return null
    }

    if (definition.kind === 'boolean') {
      return (
        <Field key={definition.key} label={definition.label}>
          <select
            value={current === true ? 'yes' : current === false ? 'no' : ''}
            onChange={event => updateAttribute(definition, event.target.value === '' ? null : event.target.value === 'yes')}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="">Not answered</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      )
    }

    if (definition.kind === 'text') {
      return (
        <Field key={definition.key} label={definition.label}>
          <Input value={typeof current === 'string' ? current : ''} onChange={event => updateAttribute(definition, event.target.value)} />
        </Field>
      )
    }

    if (definition.kind === 'multi') {
      const selected = Array.isArray(current) ? current as string[] : []
      if (definition.allowCustom || (definition.options?.length ?? 0) > 12 || !definition.options) {
        return (
          <Field key={definition.key} label={`${definition.label} (comma separated)`}>
            <Input
              value={displayList(selected, definition)}
              onChange={event => updateAttribute(definition, listFromInput(event.target.value))}
              placeholder={definition.options?.slice(0, 3).map(option => option.label).join(', ')}
            />
          </Field>
        )
      }
      return (
        <fieldset key={definition.key} className="space-y-2">
          <legend className="text-xs font-medium text-muted-foreground">{definition.label}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {definition.options.map(option => (
              <label key={option.value} className="flex min-h-9 items-center gap-2 rounded-lg border border-border/80 bg-background px-3 text-xs">
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={event => updateAttribute(definition, event.target.checked ? [...selected, option.value] : selected.filter(value => value !== option.value))}
                  className="size-4 accent-primary"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      )
    }

    return null
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div>
          <h2 className="text-sm font-semibold">Casting and search details</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">These details help hirers find relevant profiles. Every field is optional.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Year of birth">
            <Input type="number" min={1900} max={new Date().getUTCFullYear()} value={value.birth_year ?? ''} onChange={event => updateCore('birth_year', event.target.value ? Number(event.target.value) : null)} />
          </Field>
          <Field label="Gender">
            <select value={value.gender ?? ''} onChange={event => updateCore('gender', (event.target.value || null) as TalentAttributesPayload['gender'])} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30">
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non_binary">Non-binary</option>
            </select>
          </Field>
          {(category === 'actor' || category === 'dancer') && (
            <Field label="Height (cm)">
              <Input type="number" min={100} max={230} value={value.height_cm ?? ''} onChange={event => updateCore('height_cm', event.target.value ? Number(event.target.value) : null)} />
            </Field>
          )}
          <Field label="Available now">
            <select value={value.available_now === true ? 'yes' : value.available_now === false ? 'no' : ''} onChange={event => updateCore('available_now', event.target.value === '' ? null : event.target.value === 'yes')} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30">
              <option value="">Not specified</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Minimum day rate (£)">
            <Input type="number" min={0} max={20000} value={value.rate_min ?? ''} onChange={event => updateCore('rate_min', event.target.value ? Number(event.target.value) : null)} />
          </Field>
          <Field label="Maximum day rate (£)">
            <Input type="number" min={0} max={20000} value={value.rate_max ?? ''} onChange={event => updateCore('rate_max', event.target.value ? Number(event.target.value) : null)} />
          </Field>
          <Field label="Languages (comma separated)">
            <Input value={value.languages.map(humanise).join(', ')} onChange={event => updateCore('languages', listFromInput(event.target.value))} placeholder="English, French" />
          </Field>
          <Field label="Nationalities (comma separated)">
            <Input value={value.nationalities.map(humanise).join(', ')} onChange={event => updateCore('nationalities', listFromInput(event.target.value))} placeholder="British, Spanish" />
          </Field>
        </div>

        {sections.map(section => {
          const sectionDefinitions = definitions.filter(definition => definition.section === section)
          const restricted = sectionDefinitions.some(definition => definition.restricted)
          return (
            <details key={section} className="rounded-xl border border-border/80 bg-muted/20 open:bg-muted/30">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">{section}</summary>
              <div className="space-y-4 border-t border-border/70 p-4">
                {restricted && (
                  <div className="flex gap-2 rounded-lg bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    Scene preferences are stored separately and only shared with signed-in hirers. They are never shown on public cards.
                  </div>
                )}
                {sectionDefinitions.map(renderAttribute)}
              </div>
            </details>
          )
        })}
      </CardContent>
    </Card>
  )
}
