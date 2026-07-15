import type { Profile, TalentSkill } from '@/types'

type TalentProfile = Profile & { talent_skills?: TalentSkill[] }

const COMPLETION_CHECKS: Array<{ label: string; done: (p: TalentProfile) => boolean }> = [
  { label: 'Add a profile photo', done: p => Boolean(p.avatar_url) },
  { label: 'Write a headline', done: p => Boolean(p.headline?.trim()) },
  { label: 'Add your location', done: p => Boolean(p.city?.trim() || p.country?.trim()) },
  { label: 'Write a bio', done: p => Boolean(p.bio?.trim()) },
  { label: 'Add at least one skill', done: p => (p.talent_skills?.length ?? 0) > 0 },
  { label: 'Set availability', done: p => Boolean(p.availability?.trim()) },
  { label: 'Add rate guidance', done: p => Boolean(p.rates?.trim()) },
]

export function getProfileCompletion(profile: TalentProfile) {
  const completed = COMPLETION_CHECKS.filter(check => check.done(profile))
  const missing = COMPLETION_CHECKS.filter(check => !check.done(profile))
  const percent = Math.round((completed.length / COMPLETION_CHECKS.length) * 100)
  return { percent, completed: completed.map(c => c.label), missing: missing.map(c => c.label) }
}
