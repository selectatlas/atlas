'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { DEMO_PROFILE, DEMO_REVIEWS, DEMO_TALENT_ATTRIBUTES } from '@/lib/demo-data'
import { summarizeReviews } from '@/lib/reviews'
import { buildTalentLevelMetrics, type TalentLevelMetrics } from '@/lib/talent-level'
import { TalentLevelPanel } from '@/components/talent/TalentLevelPanel'
import { PhotoUpload } from '@/components/talent/PhotoUpload'
import { CoverEditor } from '@/components/talent/CoverEditor'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { SkillsEditor } from '@/components/talent/SkillsEditor'
import { CreditsEditor } from '@/components/talent/CreditsEditor'
import { PortfolioEditor } from '@/components/talent/PortfolioEditor'
import { PageShell } from '@/components/layout/PageShell'
import { ProfileCompletenessCard } from '@/components/talent/ProfileCompletenessCard'
import type { Profile, TalentSkill, Credit, PortfolioItem } from '@/types'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { TalentAttributesEditor } from '@/components/talent/TalentAttributesEditor'
import { EMPTY_TALENT_ATTRIBUTES, type TalentAttributesPayload } from '@/lib/talent-profile-attributes'

import { LabeledField } from '@/components/ui/labeled-field'

type TalentWithExtras = Profile & {
  talent_skills: TalentSkill[]
  credits: Credit[]
  portfolio_items: PortfolioItem[]
}

// The fields this form's Save actually writes. Skills, credits, portfolio and
// cover all persist themselves on change, so they must not count towards
// dirty state - otherwise Save would sit enabled with nothing to commit.
const SAVED_FIELDS = [
  'full_name', 'headline', 'city', 'country', 'bio', 'rates', 'availability', 'showreel_url',
] as const

// Save also PATCHes casting details, which live in their own card further down
// the page, so both have to feed dirty state or editing casting details would
// leave Save disabled with no way to commit it.
function snapshot(profile: Profile, attributes: TalentAttributesPayload): string {
  return JSON.stringify([SAVED_FIELDS.map(field => profile[field] ?? ''), attributes])
}

export function TalentProfileEditor() {
  const [profile, setProfile] = useState<TalentWithExtras | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Snapshot of what is currently persisted; Save stays disabled until the
  // form diverges from it (DESIGN.md - "Save placement").
  const [baseline, setBaseline] = useState<string | null>(null)
  const [talentAttributes, setTalentAttributes] = useState<TalentAttributesPayload>(EMPTY_TALENT_ATTRIBUTES)
  const [levelMetrics, setLevelMetrics] = useState<TalentLevelMetrics | null>(null)
  const embedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Skills feed the AI-search embedding directly, so edits must re-embed even
  // if the user never presses "Save Profile". Debounced to batch rapid edits
  // and stay inside the embed route's rate limit.
  const scheduleEmbedRefresh = useCallback((profileId: string) => {
    if (isLocalDemoMode()) return
    if (embedTimer.current) clearTimeout(embedTimer.current)
    embedTimer.current = setTimeout(() => {
      void fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId }),
      }).catch(() => console.warn('Embedding regeneration failed'))
    }, 1500)
  }, [])

  useEffect(() => () => {
    if (embedTimer.current) clearTimeout(embedTimer.current)
  }, [])

  const loadProfile = useCallback(async () => {
    if (isLocalDemoMode()) {
      setProfile(DEMO_PROFILE)
      setTalentAttributes(DEMO_TALENT_ATTRIBUTES[DEMO_PROFILE.id] ?? EMPTY_TALENT_ATTRIBUTES)
      const demoSummary = summarizeReviews(DEMO_REVIEWS[DEMO_PROFILE.id] ?? [])
      setLevelMetrics(buildTalentLevelMetrics({
        reviewAverage: demoSummary.average,
        reviewCount: demoSummary.count,
        hiredCount: 1,
        contactedCount: 2,
        respondedCount: 2,
      }))
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      setError('Sign in to edit your profile')
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_WITH_SKILLS)
      .eq('id', user.id)
      .single()

    if (!data) { setLoading(false); return }

    const [{ data: credits }, { data: portfolioItems }, attributesResponse, { data: reviewStats }, hiredResult, { data: outreachRows }] = await Promise.all([
      supabase.from('credits').select('*').eq('profile_id', user.id).order('sort_order').order('start_date', { ascending: false }),
      supabase.from('portfolio_items').select('*').eq('profile_id', user.id).order('sort_order'),
      fetch('/api/profile/attributes').then(response => response.ok ? response.json() : null),
      // Level inputs are all readable by the talent under RLS (own rows +
      // the aggregate talent_stats view).
      supabase.from('talent_stats').select('review_count, avg_rating').eq('profile_id', user.id).maybeSingle(),
      supabase.from('applications').select('id', { count: 'exact', head: true }).eq('talent_id', user.id).eq('status', 'hired'),
      supabase.from('outreach').select('status').eq('talent_id', user.id).neq('status', 'draft'),
    ])

    const loaded = {
      ...(data as Omit<Profile, 'email'> & { talent_skills: TalentSkill[] }),
      email: user.email ?? '',
      credits: (credits ?? []) as Credit[],
      portfolio_items: (portfolioItems ?? []) as PortfolioItem[],
    }
    setProfile(loaded)
    const loadedAttributes = (attributesResponse?.attributes as TalentAttributesPayload | undefined)
      ?? EMPTY_TALENT_ATTRIBUTES
    if (attributesResponse?.attributes) setTalentAttributes(loadedAttributes)
    setBaseline(snapshot(loaded, loadedAttributes))

    const contacted = (outreachRows ?? []) as Array<{ status: string }>
    setLevelMetrics(buildTalentLevelMetrics({
      reviewAverage: reviewStats?.avg_rating == null ? null : Number(reviewStats.avg_rating),
      reviewCount: reviewStats?.review_count ?? 0,
      hiredCount: hiredResult.count ?? 0,
      contactedCount: contacted.length,
      respondedCount: contacted.filter(row => row.status === 'responded').length,
    }))
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load profile on mount
    void loadProfile()
  }, [loadProfile])

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    setError(null)

    if (isLocalDemoMode()) {
      setBaseline(snapshot(profile, talentAttributes))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setSaving(false)
      return
    }

    const supabase = createClient()
    const [{ error }, attributesResponse] = await Promise.all([
      supabase.from('profiles').update({
        full_name: profile.full_name,
        headline: profile.headline,
        city: profile.city,
        country: profile.country,
        bio: profile.bio,
        rates: profile.rates,
        availability: profile.availability,
        showreel_url: profile.showreel_url,
      }).eq('id', profile.id),
      fetch('/api/profile/attributes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(talentAttributes),
      }),
    ])

    if (error) { setError(error.message); setSaving(false); return }
    if (!attributesResponse.ok) {
      const payload = await attributesResponse.json().catch(() => null)
      setError(payload?.error ?? 'Unable to save casting details')
      setSaving(false)
      return
    }

    try {
      await fetch('/api/embed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_id: profile.id }) })
    } catch { console.warn('Embedding regeneration failed') }

    setBaseline(snapshot(profile, talentAttributes))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  function update(field: keyof Profile, value: string) {
    setProfile(p => p ? { ...p, [field]: value } : p)
  }

  if (loading) {
    return (
      <div className="py-6 space-y-4 animate-pulse">
        <div className="h-20 bg-muted rounded-2xl" />
        <div className="h-40 bg-muted rounded-2xl" />
      </div>
    )
  }

  if (!profile) return null

  const isDirty = baseline !== null && snapshot(profile, talentAttributes) !== baseline

  return (
    <div className="space-y-6 pb-12">
      <PageShell
        title="My profile"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/talent/${profile.id}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-xl')}
            >
              <Eye className="size-4" />
              Preview public profile
            </Link>
            {/* Page-level rather than per-card: this one Save commits both the
                personal-info card and the casting-details card further down. */}
            <Button size="sm" onClick={saveProfile} disabled={saving || !isDirty}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save profile'}
            </Button>
          </div>
        }
      />

      <ProfileCompletenessCard profile={profile} attributes={talentAttributes} />

      {levelMetrics && <TalentLevelPanel metrics={levelMetrics} />}

      <div className="flex items-center gap-4">
        <PhotoUpload
          currentUrl={profile.avatar_url} initials={profile.full_name[0]}
          onUploaded={async (url) => {
            update('avatar_url', url)
            const supabase = createClient()
            await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
          }}
        />
        <div>
          <p className="font-semibold">{profile.full_name}</p>
          <p className="text-muted-foreground text-sm">{profile.email}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <CoverEditor
            profileId={profile.id}
            initials={profile.full_name[0]!}
            coverUrl={profile.cover_url}
            coverImages={profile.cover_images ?? []}
            layout={profile.cover_layout ?? 'single'}
            onChange={patch => setProfile(p => (p ? { ...p, ...patch } : p))}
            onError={setError}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="text-sm font-semibold">Personal info</h2>
          <LabeledField label="Full name">
            <Input value={profile.full_name} onChange={e => update('full_name', e.target.value)} placeholder="Your name" />
          </LabeledField>
          <LabeledField label="Headline">
            <Input value={profile.headline ?? ''} onChange={e => update('headline', e.target.value)} placeholder="Bollywood Dancer | Choreographer" />
          </LabeledField>
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="City">
              <Input value={profile.city ?? ''} onChange={e => update('city', e.target.value)} placeholder="London" />
            </LabeledField>
            <LabeledField label="Country">
              <Input value={profile.country ?? ''} onChange={e => update('country', e.target.value)} placeholder="UK" />
            </LabeledField>
          </div>
          <LabeledField label="Bio">
            <Textarea value={profile.bio ?? ''} onChange={e => update('bio', e.target.value)} className="resize-none h-28" placeholder="Describe your experience..." />
          </LabeledField>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledField label="Rates">
              <Input value={profile.rates ?? ''} onChange={e => update('rates', e.target.value)} placeholder="£300 per day" />
            </LabeledField>
            <LabeledField label="Availability">
              <Input value={profile.availability ?? ''} onChange={e => update('availability', e.target.value)} placeholder="Available from December" />
            </LabeledField>
          </div>
          <LabeledField label="Showreel URL">
            <Input type="url" value={profile.showreel_url ?? ''} onChange={e => update('showreel_url', e.target.value)} placeholder="https://youtube.com/..." />
          </LabeledField>
        </CardContent>
      </Card>

      <SkillsEditor
        profileId={profile.id}
        skills={profile.talent_skills}
        onUpdate={skills => {
          setProfile(p => p ? { ...p, talent_skills: skills } : p)
          scheduleEmbedRefresh(profile.id)
        }}
        onError={setError}
      />

      <TalentAttributesEditor
        categories={[...new Set(profile.talent_skills.map(skill => skill.category))]}
        value={talentAttributes}
        onChange={setTalentAttributes}
      />

      <CreditsEditor
        profileId={profile.id}
        credits={profile.credits}
        onUpdate={loadProfile}
        onError={setError}
      />

      <PortfolioEditor
        profileId={profile.id}
        items={profile.portfolio_items}
        onUpdate={loadProfile}
        onError={setError}
      />

      {error && (
        <p className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">{error}</p>
      )}

    </div>
  )
}
