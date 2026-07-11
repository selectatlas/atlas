import { CATEGORY_LABELS } from '@/lib/skills'
import type { Job, Profile, TalentSkill } from '@/types'

type TalentProfile = Profile & { talent_skills: TalentSkill[] }

function normalise(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getJobMatchReasons(job: Job, profile: TalentProfile | null) {
  if (!profile) return [`${CATEGORY_LABELS[job.category]} opportunity`]

  const reasons: string[] = []
  const profileSkills = profile.talent_skills.map(skill => normalise(skill.skill))
  const matchingSkill = job.skills_required.find(required => {
    const requiredSkill = normalise(required)
    return profileSkills.some(skill => skill.includes(requiredSkill) || requiredSkill.includes(skill))
  })

  if (profile.talent_skills.some(skill => skill.category === job.category)) {
    reasons.push(`${CATEGORY_LABELS[job.category]} role`)
  }
  if (matchingSkill) reasons.push(`Matches your ${matchingSkill} skill`)
  if (profile.city && normalise(job.location).includes(normalise(profile.city))) {
    reasons.push(`Based in ${profile.city}`)
  }

  const jobMonth = job.start_date
    ? new Date(`${job.start_date}T00:00:00`).toLocaleString('en-GB', { month: 'long' })
    : null
  if (jobMonth && normalise(profile.availability).includes(normalise(jobMonth))) {
    reasons.push(`Fits your ${jobMonth} availability`)
  }

  return reasons.length > 0 ? reasons.slice(0, 3) : [`Matches your ${CATEGORY_LABELS[job.category]} profile`]
}

export function getJobMeta(job: Job) {
  const dates = [formatDate(job.start_date), formatDate(job.end_date)].filter(Boolean)
  return {
    dateLabel: dates.length === 2 ? `${dates[0]} – ${dates[1]}` : dates[0] ?? null,
    deadlineLabel: formatDate(job.application_deadline),
    workTypeLabel: job.work_type === 'remote' ? 'Remote' : job.work_type === 'hybrid' ? 'Hybrid' : job.work_type === 'in_person' ? 'In person' : null,
  }
}
