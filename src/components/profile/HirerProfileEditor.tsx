'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { PageShell } from '@/components/layout/PageShell'
import { PhotoUpload } from '@/components/talent/PhotoUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { OWN_PROFILE_FIELDS } from '@/lib/profile-fields'
import { LabeledField } from '@/components/ui/labeled-field'
import type { Profile } from '@/types'

const DEMO_HIRER_PROFILE: Profile = {
  id: 'demo-hirer',
  account_type: 'hirer',
  full_name: 'Northstar Studios',
  email: 'hirer@demo.atlas',
  avatar_url: null,
  cover_url: null,
  headline: 'Casting & production',
  city: 'London',
  country: 'UK',
  bio: 'We cast dancers, actors, and creators for film, commercials, and live productions.',
  rates: null,
  availability: null,
  showreel_url: null,
  created_at: new Date().toISOString(),
}

export function HirerProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    if (isLocalDemoMode()) {
      setProfile(DEMO_HIRER_PROFILE)
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
      .select(OWN_PROFILE_FIELDS)
      .eq('id', user.id)
      .single()

    if (!data) {
      setLoading(false)
      return
    }

    setProfile({
      ...(data as Omit<Profile, 'email'>),
      email: user.email ?? '',
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load profile on mount
    void loadProfile()
  }, [loadProfile])

  function update(field: keyof Profile, value: string) {
    setProfile(p => (p ? { ...p, [field]: value } : p))
  }

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
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        headline: profile.headline,
        city: profile.city,
        country: profile.country,
        bio: profile.bio,
      })
      .eq('id', profile.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
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
    <div className="space-y-6 pb-32">
      <PageShell
        title="My profile"
        description="This is how your name and details appear on jobs and outreach."
      />

      <div className="flex items-center gap-4">
        <PhotoUpload
          currentUrl={profile.avatar_url}
          initials={profile.full_name[0] ?? 'H'}
          onUploaded={async (url) => {
            update('avatar_url', url)
            if (isLocalDemoMode()) return
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
        <CardContent className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">Personal info</h2>
          <LabeledField label="Full name">
            <Input
              value={profile.full_name}
              onChange={e => update('full_name', e.target.value)}
              placeholder="Your name"
            />
          </LabeledField>
          <LabeledField label="Headline">
            <Input
              value={profile.headline ?? ''}
              onChange={e => update('headline', e.target.value)}
              placeholder="Casting director · Music videos"
            />
          </LabeledField>
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="City">
              <Input
                value={profile.city ?? ''}
                onChange={e => update('city', e.target.value)}
                placeholder="London"
              />
            </LabeledField>
            <LabeledField label="Country">
              <Input
                value={profile.country ?? ''}
                onChange={e => update('country', e.target.value)}
                placeholder="UK"
              />
            </LabeledField>
          </div>
          <LabeledField label="Bio">
            <Textarea
              value={profile.bio ?? ''}
              onChange={e => update('bio', e.target.value)}
              className="h-28 resize-none"
              placeholder="Tell talent who you are and the work you cast for..."
            />
          </LabeledField>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="fixed bottom-20 left-0 right-0 mx-auto max-w-2xl px-4 md:bottom-8">
        <Button
          onClick={saveProfile}
          disabled={saving}
          className="h-12 w-full rounded-2xl bg-accent font-semibold text-accent-foreground shadow-sm hover:bg-accent/80"
        >
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Profile'}
        </Button>
      </div>
    </div>
  )
}
