'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_PROFILE, DEMO_TALENT_ATTRIBUTES } from '@/lib/demo-data'
import { PhotoUpload } from '@/components/talent/PhotoUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { SkillsEditor } from '@/components/talent/SkillsEditor'
import { CreditsEditor } from '@/components/talent/CreditsEditor'
import { PortfolioEditor } from '@/components/talent/PortfolioEditor'
import { ProfileCompletenessCard } from '@/components/talent/ProfileCompletenessCard'
import type { Profile, TalentSkill, Credit, PortfolioItem } from '@/types'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { TalentAttributesEditor } from '@/components/talent/TalentAttributesEditor'
import { EMPTY_TALENT_ATTRIBUTES, type TalentAttributesPayload } from '@/lib/talent-profile-attributes'

type TalentWithExtras = Profile & {
  talent_skills: TalentSkill[]
  credits: Credit[]
  portfolio_items: PortfolioItem[]
}

function isLocalDemoMode() {
  return typeof document !== 'undefined' && document.cookie.split(';').some(cookie => cookie.trim().startsWith('atlas_demo=1'))
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<TalentWithExtras | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [talentAttributes, setTalentAttributes] = useState<TalentAttributesPayload>(EMPTY_TALENT_ATTRIBUTES)

  const loadProfile = useCallback(async () => {
    if (isLocalDemoMode()) {
      setProfile(DEMO_PROFILE)
      setTalentAttributes(DEMO_TALENT_ATTRIBUTES[DEMO_PROFILE.id] ?? EMPTY_TALENT_ATTRIBUTES)
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_WITH_SKILLS)
      .eq('id', user.id)
      .single()

    if (!data) { setLoading(false); return }

    const [{ data: credits }, { data: portfolioItems }, attributesResponse] = await Promise.all([
      supabase.from('credits').select('*').eq('profile_id', user.id).order('sort_order').order('start_date', { ascending: false }),
      supabase.from('portfolio_items').select('*').eq('profile_id', user.id).order('sort_order'),
      fetch('/api/profile/attributes').then(response => response.ok ? response.json() : null),
    ])

    setProfile({
      ...(data as Omit<Profile, 'email'> & { talent_skills: TalentSkill[] }),
      email: user.email ?? '',
      credits: (credits ?? []) as Credit[],
      portfolio_items: (portfolioItems ?? []) as PortfolioItem[],
    })
    if (attributesResponse?.attributes) setTalentAttributes(attributesResponse.attributes as TalentAttributesPayload)
    setLoading(false)
  }, [])

  useEffect(() => {
    const fetch = async () => {
      await loadProfile()
    }
    fetch()
  }, [loadProfile])

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    setError(null)

    if (isLocalDemoMode()) {
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

  return (
    <div className="py-6 space-y-6 pb-32">
      <h1 className="text-xl font-bold">My Profile</h1>

      <ProfileCompletenessCard profile={profile} attributes={talentAttributes} />

      {/* Avatar & Basic Info */}
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

      {/* Personal info */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="text-sm font-semibold">Personal info</h2>
          <Field label="Full name">
            <Input value={profile.full_name} onChange={e => update('full_name', e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Headline">
            <Input value={profile.headline ?? ''} onChange={e => update('headline', e.target.value)} placeholder="Bollywood Dancer | Choreographer" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input value={profile.city ?? ''} onChange={e => update('city', e.target.value)} placeholder="London" />
            </Field>
            <Field label="Country">
              <Input value={profile.country ?? ''} onChange={e => update('country', e.target.value)} placeholder="UK" />
            </Field>
          </div>
          <Field label="Bio">
            <Textarea value={profile.bio ?? ''} onChange={e => update('bio', e.target.value)} className="resize-none h-28" placeholder="Describe your experience..." />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rates">
              <Input value={profile.rates ?? ''} onChange={e => update('rates', e.target.value)} placeholder="£300 per day" />
            </Field>
            <Field label="Availability">
              <Input value={profile.availability ?? ''} onChange={e => update('availability', e.target.value)} placeholder="Available from December" />
            </Field>
          </div>
          <Field label="Showreel URL">
            <Input type="url" value={profile.showreel_url ?? ''} onChange={e => update('showreel_url', e.target.value)} placeholder="https://youtube.com/..." />
          </Field>
        </CardContent>
      </Card>

      <SkillsEditor
        profileId={profile.id}
        skills={profile.talent_skills}
        onUpdate={skills => setProfile(p => p ? { ...p, talent_skills: skills } : p)}
        onError={setError}
      />

      <TalentAttributesEditor
        category={profile.talent_skills[0]?.category ?? null}
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

      <div className="fixed bottom-20 left-0 right-0 px-4 max-w-2xl mx-auto">
        <Button
          onClick={saveProfile}
          disabled={saving}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/80 h-12 rounded-2xl font-semibold shadow-lg"
        >
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Profile'}
        </Button>
      </div>
    </div>
  )
}
