'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SKILLS_BY_CATEGORY, CATEGORY_LABELS } from '@/lib/skills'
import { PhotoUpload } from '@/components/talent/PhotoUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LabeledField } from '@/components/ui/labeled-field'
import type { Category } from '@/types'

interface OnboardingWizardProps {
  profileId: string
  fullName: string
  initialAvatarUrl: string | null
  // Validated destination from a pre-signup CTA; finishing or skipping the
  // wizard resumes it instead of landing on the profile preview.
  nextPath?: string | null
}

const CATEGORY_OPTIONS: Array<{ value: Category; emoji: string; description: string }> = [
  { value: 'dancer', emoji: '💃', description: 'Commercial, classical, street and stage dance' },
  { value: 'actor', emoji: '🎭', description: 'Film, TV, theatre and voice work' },
  { value: 'photographer_videographer', emoji: '📸', description: 'Photography and videography' },
  { value: 'content_creator', emoji: '📱', description: 'Social-first content and creator work' },
]

const STEP_TITLES = [
  'What kind of talent are you?',
  'Pick your strongest skills',
  'Add a profile photo',
  'Introduce yourself',
  'Rates and availability',
  'Show your work',
]

export function OnboardingWizard({ profileId, fullName, initialAvatarUrl, nextPath }: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState<Category | null>(null)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [customSkill, setCustomSkill] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [rates, setRates] = useState('')
  const [availableNow, setAvailableNow] = useState<boolean | null>(null)
  const [availability, setAvailability] = useState('')
  const [showreelUrl, setShowreelUrl] = useState('')
  const [creditTitle, setCreditTitle] = useState('')
  const [creditProduction, setCreditProduction] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggestedSkills = category ? SKILLS_BY_CATEGORY[category] : []

  function toggleSkill(skill: string) {
    setSelectedSkills(current =>
      current.includes(skill) ? current.filter(s => s !== skill) : [...current, skill]
    )
  }

  function addCustomSkill() {
    const skill = customSkill.trim()
    if (!skill) return
    if (!selectedSkills.some(s => s.toLowerCase() === skill.toLowerCase())) {
      setSelectedSkills(current => [...current, skill])
    }
    setCustomSkill('')
  }

  async function finish() {
    if (!category || selectedSkills.length === 0 || !headline.trim()) return
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          skills: selectedSkills,
          headline,
          bio,
          city,
          country,
          rates,
          availability,
          availableNow,
          showreelUrl: showreelUrl.trim() || null,
          firstCredit: creditTitle.trim() && creditProduction.trim()
            ? { title: creditTitle.trim(), production: creditProduction.trim() }
            : null,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.error ?? 'Unable to finish setup. Please try again.')
        setSaving(false)
        return
      }
    } catch {
      setError('Unable to reach the server. Please try again.')
      setSaving(false)
      return
    }

    // Embed immediately so the new profile is discoverable in AI search.
    try {
      await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId }),
      })
    } catch {
      console.warn('Embedding regeneration failed')
    }

    router.push(nextPath ?? `/talent/${profileId}`)
    router.refresh()
  }

  // The work step is optional, but reject a half-filled credit or a non-https
  // link before the server does.
  const showreelValid = !showreelUrl.trim() || /^https:\/\//.test(showreelUrl.trim())
  const creditValid = Boolean(creditTitle.trim()) === Boolean(creditProduction.trim())

  const canContinue =
    step === 0 ? category !== null :
    step === 1 ? selectedSkills.length > 0 :
    step === 3 ? headline.trim().length > 0 :
    step === 5 ? showreelValid && creditValid :
    true

  const workStepEmpty = !showreelUrl.trim() && !creditTitle.trim() && !creditProduction.trim()

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Welcome to Atlas{fullName ? `, ${fullName.split(' ')[0]}` : ''}
          </p>
          <h1 className="mt-1 text-xl font-bold">{STEP_TITLES[step]}</h1>
        </div>
        <Link href={nextPath ?? '/home'} className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
          Skip for now
        </Link>
      </div>

      <div className="flex gap-1.5" role="progressbar" aria-label="Onboarding progress" aria-valuemin={1} aria-valuemax={STEP_TITLES.length} aria-valuenow={step + 1}>
        {STEP_TITLES.map((title, index) => (
          <div
            key={title}
            className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {CATEGORY_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (category !== option.value) setSelectedSkills([])
                    setCategory(option.value)
                  }}
                  aria-pressed={category === option.value}
                  className={`h-auto flex-col items-start rounded-xl border-2 p-4 text-left whitespace-normal ${
                    category === option.value ? 'border-primary bg-primary/5' : 'border-border bg-muted/50'
                  }`}
                >
                  <div className="text-2xl mb-2">{option.emoji}</div>
                  <div className="text-sm font-semibold">{CATEGORY_LABELS[option.value]}</div>
                  <div className="mt-0.5 text-xs font-normal text-muted-foreground">{option.description}</div>
                </Button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pick at least one - three or more makes your profile much easier to find. You can refine proficiency later.
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedSkills.map(skill => {
                  const selected = selectedSkills.includes(skill)
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      aria-pressed={selected}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-muted/50 text-foreground hover:border-primary/40'
                      }`}
                    >
                      {skill}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-end gap-2">
                <LabeledField label="Something else?" className="flex-1">
                  <Input
                    value={customSkill}
                    onChange={e => setCustomSkill(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill() } }}
                    placeholder="Add your own skill"
                  />
                </LabeledField>
                <Button variant="outline" onClick={addCustomSkill} disabled={!customSkill.trim()}>Add</Button>
              </div>
              {selectedSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedSkills.map(skill => (
                    <Badge key={skill} variant="secondary" className="gap-1 text-xs">
                      {skill}
                      <Button type="button" variant="ghost" size="icon-xs" className="ml-0.5 size-auto p-0 hover:bg-transparent" onClick={() => toggleSkill(skill)}>✕</Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Profiles with a face get far more attention from hirers. You can skip this and add one later.
              </p>
              <PhotoUpload
                currentUrl={avatarUrl}
                initials={fullName[0] ?? '?'}
                onUploaded={async (url) => {
                  setAvatarUrl(url)
                  const supabase = createClient()
                  await supabase.from('profiles').update({ avatar_url: url }).eq('id', profileId)
                }}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <LabeledField label="Headline">
                <Input
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  placeholder="Bollywood Dancer | Choreographer"
                />
              </LabeledField>
              <p className="text-xs text-muted-foreground">Say what you do in the words hirers search for.</p>
              <LabeledField label="Bio (optional)">
                <Textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="h-28 resize-none"
                  placeholder="A short story about your experience and the work you love..."
                />
              </LabeledField>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <LabeledField label="City">
                  <Input value={city} onChange={e => setCity(e.target.value)} placeholder="London" />
                </LabeledField>
                <LabeledField label="Country">
                  <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="UK" />
                </LabeledField>
              </div>
              <LabeledField label="Indicative rate (optional)">
                <Input value={rates} onChange={e => setRates(e.target.value)} placeholder="£300 per day" />
              </LabeledField>
              {/* Free-text availability is what hirers read on the profile and
                  what the completeness meter scores - the available-now toggle
                  below is the structured filter and does not replace it. */}
              <LabeledField label="When are you available? (optional)">
                <Input
                  value={availability}
                  onChange={e => setAvailability(e.target.value)}
                  placeholder="Available December and January, two weeks notice"
                />
              </LabeledField>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Available for work right now?</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    aria-pressed={availableNow === true}
                    onClick={() => setAvailableNow(true)}
                    className={`rounded-xl ${availableNow === true ? 'border-primary bg-primary/5' : ''}`}
                  >
                    Yes, available now
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    aria-pressed={availableNow === false}
                    onClick={() => setAvailableNow(false)}
                    className={`rounded-xl ${availableNow === false ? 'border-primary bg-primary/5' : ''}`}
                  >
                    Not right now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Proof of work is the fastest way to win a hirer&apos;s trust. Both fields are optional - you can add more from your profile later.
              </p>
              <LabeledField label="Showreel link (optional)">
                <Input
                  value={showreelUrl}
                  onChange={e => setShowreelUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  inputMode="url"
                />
              </LabeledField>
              {!showreelValid && (
                <p className="text-xs text-destructive">Showreel link must start with https://</p>
              )}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Your proudest credit (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <LabeledField label="Your role">
                    <Input value={creditTitle} onChange={e => setCreditTitle(e.target.value)} placeholder="Lead Dancer" maxLength={120} />
                  </LabeledField>
                  <LabeledField label="Production">
                    <Input value={creditProduction} onChange={e => setCreditProduction(e.target.value)} placeholder="The Nutcracker" maxLength={120} />
                  </LabeledField>
                </div>
                {!creditValid && (
                  <p className="mt-1.5 text-xs text-destructive">Add both a role and a production, or leave both empty.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0 || saving}
        >
          Back
        </Button>
        {step < STEP_TITLES.length - 1 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={!canContinue}
            className="h-11 rounded-xl bg-accent px-6 font-semibold text-accent-foreground hover:bg-accent/80"
          >
            Continue
          </Button>
        ) : (
          <Button
            onClick={finish}
            disabled={saving || !canContinue}
            className="h-11 rounded-xl bg-accent px-6 font-semibold text-accent-foreground hover:bg-accent/80"
          >
            {saving ? 'Setting up...' : workStepEmpty ? 'Skip and finish' : nextPath ? 'Finish and continue' : 'Finish and preview my profile'}
          </Button>
        )}
      </div>
    </div>
  )
}
