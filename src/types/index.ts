export type AccountType = 'hirer' | 'talent'
export type PlatformAdminRole = 'owner' | 'moderator' | 'support'
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'
export type Category = 'dancer' | 'actor' | 'photographer_videographer' | 'content_creator'
export type Proficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type ApplicationStatus = 'sent' | 'viewed' | 'responded' | 'shortlisted' | 'hired'
export type OutreachStatus = 'draft' | 'sent' | 'viewed' | 'responded'
export type JobStatus = 'open' | 'closed'
export type JobWorkType = 'in_person' | 'remote' | 'hybrid'
export type ProfileVisibility = 'public' | 'members' | 'private'

export interface NotificationChannelPrefs {
  in_app: boolean
  email: boolean
}

export interface NotificationPreferences {
  messages: NotificationChannelPrefs
  applications: NotificationChannelPrefs
  outreach: NotificationChannelPrefs
  job_matches: NotificationChannelPrefs
  shortlist: NotificationChannelPrefs
}

export interface HirerJobDefaults {
  category: Category | null
  location: string | null
  budget: string | null
  skills_required: string[]
}

export interface HirerOutreachDefaults {
  tone_context: string | null
}

export interface Profile {
  id: string
  account_type: AccountType
  full_name: string
  email: string
  avatar_url: string | null
  cover_url: string | null
  headline: string | null
  city: string | null
  country: string | null
  bio: string | null
  rates: string | null
  availability: string | null
  showreel_url: string | null
  profile_visibility?: ProfileVisibility
  suspended_at?: string | null
  suspension_reason?: string | null
  created_at: string
}

export interface PlatformReport {
  id: string
  reporter_id: string
  reported_profile_id: string | null
  reported_job_id: string | null
  reason: string
  details: string | null
  status: ReportStatus
  admin_notes: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export interface TalentSkill {
  id: string
  profile_id: string
  category: Category
  skill: string
  proficiency: Proficiency
  created_at: string
}

export interface Job {
  id: string
  hirer_id: string
  title: string
  description: string
  category: Category
  skills_required: string[]
  location: string
  budget: string | null
  status: JobStatus
  removed_at?: string | null
  removal_reason?: string | null
  created_at: string
  work_type?: JobWorkType | null
  start_date?: string | null
  end_date?: string | null
  application_deadline?: string | null
  duration?: string | null
  usage_rights?: string | null
  travel_required?: boolean | null
}

export interface Credit {
  id: string
  profile_id: string
  title: string
  production: string
  company: string | null
  start_date: string | null
  end_date: string | null
  description: string | null
  media_url: string | null
  category: Category | null
  sort_order: number
  created_at: string
}

export interface PortfolioItem {
  id: string
  profile_id: string
  type: 'video' | 'image' | 'link'
  url: string
  title: string | null
  description: string | null
  thumbnail_url: string | null
  sort_order: number
  created_at: string
}

export interface TalentSearchResult {
  profile: Profile & { talent_skills: TalentSkill[] }
  match_score: number
  match_reasons?: string[]
}

export interface TalentProfileAttributes {
  profile_id: string
  birth_year: number | null
  gender: 'male' | 'female' | 'non_binary' | null
  height_cm: number | null
  rate_min: number | null
  rate_max: number | null
  rate_unit: 'day' | null
  rate_currency: 'GBP'
  languages: string[]
  nationalities: string[]
  available_now: boolean | null
  public_attributes: Record<string, string | string[] | boolean | number | null>
  updated_at: string
}

export interface TalentSensitivePreferences {
  profile_id: string
  preferences: Record<string, boolean | null>
  updated_at: string
}
