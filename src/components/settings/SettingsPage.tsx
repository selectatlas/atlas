'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { LogOut, UserRound } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { TalentAttributesEditor } from '@/components/talent/TalentAttributesEditor'
import { EMPTY_TALENT_ATTRIBUTES, type TalentAttributesPayload } from '@/lib/talent-profile-attributes'
import { CATEGORY_LABELS, SKILLS_BY_CATEGORY } from '@/lib/skills'
import {
  DEFAULT_HIRER_JOB_DEFAULTS,
  DEFAULT_HIRER_OUTREACH_DEFAULTS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  PROFILE_VISIBILITY_OPTIONS,
} from '@/lib/settings'
import type {
  AccountType,
  Category,
  HirerJobDefaults,
  HirerOutreachDefaults,
  NotificationPreferences,
  ProfileVisibility,
} from '@/types'

type SettingsSection = 'account' | 'notifications' | 'privacy' | 'matching' | 'workspace'

const SECTIONS: Array<{ id: SettingsSection; label: string; roles: AccountType[] }> = [
  { id: 'account', label: 'Account', roles: ['hirer', 'talent'] },
  { id: 'notifications', label: 'Notifications', roles: ['hirer', 'talent'] },
  { id: 'privacy', label: 'Discoverability', roles: ['talent'] },
  { id: 'matching', label: 'Matching', roles: ['talent'] },
  { id: 'workspace', label: 'Workspace', roles: ['hirer'] },
]

const NOTIFICATION_LABELS: Record<keyof NotificationPreferences, string> = {
  messages: 'Messages',
  applications: 'Applications',
  outreach: 'Outreach',
  job_matches: 'Job matches',
  shortlist: 'Shortlist updates',
}

function demoRole(): AccountType {
  if (typeof document === 'undefined') return 'talent'
  const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('atlas_demo_role='))
  return match?.endsWith('hirer') ? 'hirer' : 'talent'
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
    />
  )
}

function isSettingsSection(value: string | null): value is SettingsSection {
  return value === 'account'
    || value === 'notifications'
    || value === 'privacy'
    || value === 'matching'
    || value === 'workspace'
}

export function SettingsPage() {
  const searchParams = useSearchParams()
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [section, setSection] = useState<SettingsSection>('account')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; name: string }>>([])
  const [blocksLoading, setBlocksLoading] = useState(false)

  const [visibility, setVisibility] = useState<ProfileVisibility>('public')
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)
  const [jobDefaults, setJobDefaults] = useState<HirerJobDefaults>(DEFAULT_HIRER_JOB_DEFAULTS)
  const [outreachDefaults, setOutreachDefaults] = useState<HirerOutreachDefaults>(DEFAULT_HIRER_OUTREACH_DEFAULTS)
  const [talentAttributes, setTalentAttributes] = useState<TalentAttributesPayload>(EMPTY_TALENT_ATTRIBUTES)
  const [talentCategories, setTalentCategories] = useState<Category[]>([])
  const [skillInput, setSkillInput] = useState('')

  const availableSections = useMemo(
    () => SECTIONS.filter(item => (accountType ? item.roles.includes(accountType) : false)),
    [accountType],
  )

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (isLocalDemoMode()) {
      const role = demoRole()
      setAccountType(role)
      setEmail(role === 'hirer' ? 'hirer@demo.atlas' : 'talent@demo.atlas')
      setVisibility('public')
      setNotifications(DEFAULT_NOTIFICATION_PREFERENCES)
      setJobDefaults(DEFAULT_HIRER_JOB_DEFAULTS)
      setOutreachDefaults(DEFAULT_HIRER_OUTREACH_DEFAULTS)
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/me/settings')
      if (!response.ok) {
        setError('Unable to load settings')
        return
      }

      const data = await response.json()
      setAccountType(data.account_type)
      setEmail(data.email)
      setVisibility(data.profile_visibility ?? 'public')
      setNotifications(data.notification_preferences ?? DEFAULT_NOTIFICATION_PREFERENCES)
      if (data.account_type === 'hirer') {
        setJobDefaults(data.job_defaults ?? DEFAULT_HIRER_JOB_DEFAULTS)
        setOutreachDefaults(data.outreach_defaults ?? DEFAULT_HIRER_OUTREACH_DEFAULTS)
      }

      if (data.account_type === 'talent') {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const [attributesResponse, profileResult] = await Promise.all([
          fetch('/api/profile/attributes'),
          user
            ? supabase
                .from('profiles')
                .select('talent_skills(category)')
                .eq('id', user.id)
                .single()
            : Promise.resolve({ data: null }),
        ])
        if (attributesResponse.ok) {
          const payload = await attributesResponse.json()
          if (payload.attributes) setTalentAttributes(payload.attributes)
        }
        // Every discipline they work in, not just whichever skill row came
        // back first - a single category hides sections that apply to them.
        const skills = (profileResult.data as { talent_skills?: Array<{ category: Category }> } | null)
          ?.talent_skills ?? []
        setTalentCategories([...new Set(skills.map(skill => skill.category))])
      }
    } catch {
      setError('Unable to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load settings on mount
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    const requested = searchParams.get('section')
    if (!isSettingsSection(requested)) return
    if (!accountType) return
    const allowed = SECTIONS.find(item => item.id === requested && item.roles.includes(accountType))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync active section from the URL
    if (allowed) setSection(requested)
  }, [searchParams, accountType])

  const activeSection = availableSections.some(item => item.id === section)
    ? section
    : (availableSections[0]?.id ?? 'account')

  async function persist(body: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    setSaved(false)

    if (isLocalDemoMode()) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setSaving(false)
      return true
    }

    const response = await fetch('/api/me/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to save settings')
      setSaving(false)
      return false
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
    return true
  }

  async function saveNotifications() {
    await persist({ notification_preferences: notifications })
  }

  async function saveVisibility() {
    await persist({ profile_visibility: visibility })
  }

  async function saveWorkspace() {
    await persist({
      job_defaults: jobDefaults,
      outreach_defaults: outreachDefaults,
    })
  }

  async function saveMatching() {
    setSaving(true)
    setError(null)
    if (isLocalDemoMode()) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setSaving(false)
      return
    }
    const response = await fetch('/api/profile/attributes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(talentAttributes),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to save matching preferences')
      setSaving(false)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  async function requestPasswordReset() {
    setPasswordMessage(null)
    if (!email) {
      setPasswordMessage('No email on this account.')
      return
    }
    if (isLocalDemoMode()) {
      setPasswordMessage('Demo mode: password reset is disabled.')
      return
    }
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setPasswordMessage(resetError ? resetError.message : 'Password reset email sent.')
  }

  async function loadBlocks() {
    if (isLocalDemoMode()) return
    setBlocksLoading(true)
    try {
      const response = await fetch('/api/blocks')
      if (!response.ok) return
      const data = await response.json() as { blocks?: Array<{ blocked_id: string }> }
      const ids = (data.blocks ?? []).map(block => block.blocked_id)
      if (ids.length === 0) {
        setBlockedUsers([])
        return
      }
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids)
      setBlockedUsers((profiles ?? []).map(profile => ({
        id: profile.id as string,
        name: (profile.full_name as string) || 'Unknown user',
      })))
    } finally {
      setBlocksLoading(false)
    }
  }

  useEffect(() => {
    if (activeSection !== 'account' || isLocalDemoMode()) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load blocked users when account tab is active
    void loadBlocks()
  }, [activeSection])

  async function exportAccountData() {
    if (isLocalDemoMode()) {
      setError('Export is disabled in demo mode')
      return
    }
    setExporting(true)
    setError(null)
    try {
      const response = await fetch('/api/account/export')
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `atlas-export-${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Unable to export account data')
    } finally {
      setExporting(false)
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'delete my account') {
      setError('Type "delete my account" to confirm deletion')
      return
    }
    if (isLocalDemoMode()) {
      setError('Account deletion is disabled in demo mode')
      return
    }
    setDeleting(true)
    setError(null)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'delete my account' }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.error ?? 'Account deletion failed')
        return
      }
      window.location.href = '/login'
    } catch {
      setError('Account deletion failed')
    } finally {
      setDeleting(false)
    }
  }

  async function unblockUser(blockedId: string) {
    const response = await fetch('/api/blocks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked_id: blockedId }),
    })
    if (response.ok) setBlockedUsers(prev => prev.filter(user => user.id !== blockedId))
  }

  function addSkill(skill: string) {
    const next = skill.trim()
    if (!next || jobDefaults.skills_required.includes(next)) return
    setJobDefaults(prev => ({ ...prev, skills_required: [...prev.skills_required, next] }))
    setSkillInput('')
  }

  if (loading) {
    return (
      <div className="space-y-4 py-6 animate-pulse">
        <div className="h-10 w-40 rounded-xl bg-muted" />
        <div className="h-48 rounded-2xl bg-muted" />
      </div>
    )
  }

  if (!accountType) {
    return (
      <div className="space-y-4 py-6">
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error ?? 'Unable to load settings'}
        </p>
        <Button variant="outline" onClick={() => void loadSettings()}>
          Try again
        </Button>
      </div>
    )
  }

  const skillSuggestions = jobDefaults.category ? SKILLS_BY_CATEGORY[jobDefaults.category] : []

  return (
    <div className="space-y-6 pb-28">
      <PageShell
        description={`Manage account, notifications, and ${accountType === 'hirer' ? 'workspace defaults' : 'discoverability'}.`}
      />

      <div className="flex flex-wrap gap-2">
        {availableSections.map(item => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={activeSection === item.id ? 'default' : 'secondary'}
            className="rounded-full"
            onClick={() => {
              setSection(item.id)
              if (item.id === 'account') void loadBlocks()
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
          Settings saved.
        </p>
      )}

      {activeSection === 'account' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Account</h2>
                  <p className="text-xs text-muted-foreground">Signed in as {email ?? 'unknown'}</p>
                </div>
                <Badge variant="secondary">{accountType === 'hirer' ? 'Hirer' : 'Talent'}</Badge>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Email</p>
                <p className="mt-1 font-medium">{email ?? '—'}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Email changes go through Supabase Auth password reset / support for now.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/profile"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
                >
                  <UserRound className="size-4" />
                  Edit profile
                </Link>
                <Button variant="outline" onClick={requestPasswordReset}>
                  Send password reset
                </Button>
              </div>
              {passwordMessage && (
                <p className="text-sm text-muted-foreground">{passwordMessage}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h2 className="text-sm font-semibold">Data &amp; safety</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Export your data, manage blocks, or permanently delete your account.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void exportAccountData()} disabled={exporting}>
                  {exporting ? 'Preparing export...' : 'Download my data'}
                </Button>
              </div>
              <div className="rounded-xl border border-border px-4 py-3">
                <p className="text-sm font-medium">Blocked users</p>
                {blocksLoading ? (
                  <p className="mt-2 text-xs text-muted-foreground">Loading blocks...</p>
                ) : blockedUsers.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">You have not blocked anyone.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {blockedUsers.map(user => (
                      <li key={user.id} className="flex items-center justify-between gap-3 text-sm">
                        <span>{user.name}</span>
                        <Button variant="ghost" size="sm" onClick={() => void unblockUser(user.id)}>
                          Unblock
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 space-y-3">
                <p className="text-sm font-medium text-destructive">Delete account</p>
                <p className="text-xs text-muted-foreground">
                  This is immediate and irreversible. All profile data, jobs, messages, and uploads are permanently removed.
                </p>
                <Input
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder='Type "delete my account" to confirm'
                />
                <Button variant="destructive" onClick={() => void deleteAccount()} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete my account'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <form action={signOut}>
                <Button type="submit" variant="ghost" className="w-full justify-start gap-3 px-1 py-2 text-muted-foreground hover:text-foreground">
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'notifications' && (
        <Card>
          <CardContent className="space-y-5 p-5">
            <div>
              <h2 className="text-sm font-semibold">Notification preferences</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                In-app preferences are saved now. Email delivery is not available yet.
              </p>
            </div>
            <div className="space-y-4">
              {(Object.keys(NOTIFICATION_LABELS) as Array<keyof NotificationPreferences>).map(key => {
                if (accountType === 'hirer' && key === 'job_matches') return null
                if (accountType === 'talent' && key === 'applications') return null
                return (
                  <div key={key} className="rounded-xl border border-border px-4 py-3">
                    <p className="text-sm font-medium">{NOTIFICATION_LABELS[key]}</p>
                    <div className="mt-3 flex flex-wrap gap-6">
                      <label className="flex items-center gap-3 text-sm text-muted-foreground">
                        In-app
                        <Toggle
                          label={`${NOTIFICATION_LABELS[key]} in-app`}
                          checked={notifications[key].in_app}
                          onChange={next => setNotifications(prev => ({
                            ...prev,
                            [key]: { ...prev[key], in_app: next },
                          }))}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
            <Button onClick={saveNotifications} disabled={saving}>
              {saving ? 'Saving...' : 'Save notifications'}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeSection === 'privacy' && accountType === 'talent' && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-sm font-semibold">Discoverability</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Private profiles are excluded from search. This is enforced in the database, not just the UI.
              </p>
            </div>
            <div className="space-y-2">
              {PROFILE_VISIBILITY_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  onClick={() => setVisibility(option.value)}
                  className={`h-auto w-full flex-col items-start rounded-xl px-4 py-3 text-left ${
                    visibility === option.value ? 'border-foreground bg-muted/60' : ''
                  }`}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">{option.description}</p>
                </Button>
              ))}
            </div>
            <Button onClick={saveVisibility} disabled={saving}>
              {saving ? 'Saving...' : 'Save discoverability'}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeSection === 'matching' && accountType === 'talent' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2 p-5">
              <h2 className="text-sm font-semibold">Matching preferences</h2>
              <p className="text-xs text-muted-foreground">
                Casting details and scene comfort used for search filters. Scene comfort stays hirer-only.
              </p>
            </CardContent>
          </Card>
          <TalentAttributesEditor
            categories={talentCategories}
            value={talentAttributes}
            onChange={setTalentAttributes}
          />
          <Button onClick={saveMatching} disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Saving...' : 'Save matching preferences'}
          </Button>
        </div>
      )}

      {activeSection === 'workspace' && accountType === 'hirer' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h2 className="text-sm font-semibold">Job posting defaults</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Prefills the new job form. You can still edit each post.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Category</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
                    <Button
                      key={cat}
                      type="button"
                      size="sm"
                      variant={jobDefaults.category === cat ? 'default' : 'secondary'}
                      className="rounded-full"
                      onClick={() => setJobDefaults(prev => ({
                        ...prev,
                        category: prev.category === cat ? null : cat,
                        skills_required: prev.category === cat ? prev.skills_required : [],
                      }))}
                    >
                      {CATEGORY_LABELS[cat]}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Location</label>
                  <Input
                    value={jobDefaults.location ?? ''}
                    onChange={e => setJobDefaults(prev => ({ ...prev, location: e.target.value || null }))}
                    placeholder="London"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Budget</label>
                  <Input
                    value={jobDefaults.budget ?? ''}
                    onChange={e => setJobDefaults(prev => ({ ...prev, budget: e.target.value || null }))}
                    placeholder="£350/day"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Default skills</label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {jobDefaults.skills_required.map(skill => (
                    <Button
                      key={skill}
                      type="button"
                      size="xs"
                      variant="secondary"
                      className="rounded-full"
                      onClick={() => setJobDefaults(prev => ({
                        ...prev,
                        skills_required: prev.skills_required.filter(item => item !== skill),
                      }))}
                    >
                      {skill} ×
                    </Button>
                  ))}
                </div>
                <Input
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill(skillInput)
                    }
                  }}
                  placeholder="Add a skill and press Enter"
                />
                {skillSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {skillSuggestions.slice(0, 8).map(skill => (
                      <Button
                        key={skill}
                        type="button"
                        size="xs"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => addSkill(skill)}
                      >
                        + {skill}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h2 className="text-sm font-semibold">Outreach defaults</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Default context passed into the outreach generator.
                </p>
              </div>
              <Textarea
                value={outreachDefaults.tone_context ?? ''}
                onChange={e => setOutreachDefaults({ tone_context: e.target.value || null })}
                className="min-h-24 resize-none"
                placeholder="e.g. casting director hiring dancers for a music video in London"
              />
              <Button onClick={saveWorkspace} disabled={saving}>
                {saving ? 'Saving...' : 'Save workspace defaults'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
