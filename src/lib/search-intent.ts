import type { ParsedQuery } from '@/lib/openai'

/**
 * Human-readable chips for the parsed-intent artefact row above AI search
 * results ("Understood: contemporary dancer, London, available December").
 * Only fields the LLM actually extracted produce a chip.
 */
export function parsedIntentChips(parsed: ParsedQuery): string[] {
  const chips: string[] = []
  if (parsed.category) chips.push(parsed.category.replace(/_/g, ' '))
  chips.push(...parsed.skills)
  if (parsed.location) chips.push(parsed.location)
  if (parsed.availability) chips.push(`Available: ${parsed.availability}`)
  chips.push(...parsed.languages)
  chips.push(...parsed.gender.map(g => g.replace(/_/g, ' ')))
  if (parsed.age_min !== null && parsed.age_max !== null) chips.push(`Age ${parsed.age_min}-${parsed.age_max}`)
  else if (parsed.age_min !== null) chips.push(`Age ${parsed.age_min}+`)
  else if (parsed.age_max !== null) chips.push(`Age up to ${parsed.age_max}`)
  if (parsed.spact === true) chips.push('SPACT')
  return chips
}
