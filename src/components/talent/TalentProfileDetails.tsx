import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { FILTER_BY_KEY } from '@/lib/filter-taxonomy'

export interface TalentDisplayDetails {
  age: number | null
  gender: string | null
  height_cm: number | null
  rate_min: number | null
  rate_max: number | null
  languages: string[]
  nationalities: string[]
  available_now: boolean | null
  public_attributes: Record<string, unknown>
  sensitive_preferences?: Record<string, boolean | null>
}

function humanise(value: string) {
  return value.replace(/_/g, ' ').replace(/^\w/, character => character.toUpperCase())
}

function displayValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(item => humanise(String(item))).join(', ')
  return humanise(String(value))
}

export function TalentProfileDetails({ details }: { details: TalentDisplayDetails }) {
  const core = [
    details.age ? ['Age', String(details.age)] : null,
    details.gender ? ['Gender', humanise(details.gender)] : null,
    details.height_cm ? ['Height', `${details.height_cm} cm`] : null,
    details.languages.length > 0 ? ['Languages', details.languages.map(humanise).join(', ')] : null,
    details.nationalities.length > 0 ? ['Nationality', details.nationalities.map(humanise).join(', ')] : null,
    details.available_now !== null ? ['Available now', details.available_now ? 'Yes' : 'No'] : null,
  ].filter((item): item is string[] => Boolean(item))

  const publicEntries = Object.entries(details.public_attributes).filter(([, value]) => value !== null && value !== '' && (!Array.isArray(value) || value.length > 0))
  const sensitiveEntries = Object.entries(details.sensitive_preferences ?? {})
  if (core.length === 0 && publicEntries.length === 0 && sensitiveEntries.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Profile details</h2>
      <Card className="divide-y divide-border/70 border border-border/80 p-0 shadow-none">
        {core.length > 0 && (
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {core.map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>)}
          </div>
        )}
        {publicEntries.length > 0 && (
          <div className="space-y-3 p-4">
            {publicEntries.map(([key, value]) => (
              <div key={key} className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground">{FILTER_BY_KEY.get(key)?.label ?? humanise(key)}</span>
                <span className="max-w-md text-right text-sm">{displayValue(value)}</span>
              </div>
            ))}
          </div>
        )}
        {sensitiveEntries.length > 0 && (
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-medium text-muted-foreground">Talent-declared scene preferences</p><Badge variant="outline">Hirer only</Badge></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {sensitiveEntries.map(([key, value]) => <div key={key} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs"><span>{FILTER_BY_KEY.get(key)?.label ?? humanise(key)}</span><span className="font-medium">{value ? 'Yes' : 'No'}</span></div>)}
            </div>
          </div>
        )}
      </Card>
    </section>
  )
}
