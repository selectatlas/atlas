import Link from 'next/link'
import { BriefcaseBusiness, Mail } from 'lucide-react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DemoActivity } from '@/components/talent/DemoActivity'
import type { Profile, TalentSkill, Job, ApplicationStatus, OutreachStatus, Category } from '@/types'
import type { User, SupabaseClient } from '@supabase/supabase-js'

// --- Talent types & variants ---
const APP_STATUS_VARIANTS: Record<ApplicationStatus, 'outline' | 'secondary' | 'default'> = {
  sent: 'outline', viewed: 'secondary', responded: 'default', shortlisted: 'default', hired: 'default',
}
const OUTREACH_STATUS_VARIANTS: Record<OutreachStatus, 'outline' | 'secondary' | 'default'> = {
  draft: 'outline', sent: 'secondary', viewed: 'default', responded: 'default',
}

type AppRow = {
  id: string
  status: ApplicationStatus
  created_at: string
  jobs: { title: string; category: Category; location: string } | null
}

type OutreachRow = {
  id: string
  message: string
  status: OutreachStatus
  created_at: string
  profiles: { full_name: string } | null
}

type ActivityItem =
  | { type: 'application'; at: string; data: AppRow }
  | { type: 'outreach'; at: string; data: OutreachRow }

// --- Hirer View Component ---
async function HirerActivity({ user, supabase }: { user: User, supabase: SupabaseClient }) {
  const [
    { count: outreachCount },
    { count: shortlistCount },
    { data: jobs },
    { data: shortlistRows },
  ] = await Promise.all([
    supabase.from('outreach').select('id', { count: 'exact', head: true }).eq('hirer_id', user.id),
    supabase.from('shortlists').select('id', { count: 'exact', head: true }).eq('hirer_id', user.id),
    supabase.from('jobs').select('*').eq('hirer_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('shortlists').select('talent_id, created_at, profiles!talent_id(full_name, avatar_url, city, country, talent_skills(skill))').eq('hirer_id', user.id).order('created_at', { ascending: false }).limit(5),
  ])

  const shortlisted = (shortlistRows ?? []) as unknown as Array<{
    talent_id: string
    created_at: string
    profiles: (Profile & { talent_skills: TalentSkill[] }) | null
  }>

  const jobIds = (jobs ?? []).map((j: Job) => j.id)
  const { data: appCounts } = jobIds.length > 0
    ? await supabase.from('applications').select('job_id').in('job_id', jobIds)
    : { data: [] }

  const appCountMap = new Map<string, number>()
  for (const row of (appCounts ?? [])) {
    const jid = (row as { job_id: string }).job_id
    appCountMap.set(jid, (appCountMap.get(jid) ?? 0) + 1)
  }

  return (
    <div className="space-y-8 py-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Workspace</p>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">A quick view of what is moving across your workspace.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border border-border/80 p-4 shadow-none">
          <p className="text-2xl font-bold">{outreachCount ?? 0}</p>
          <p className="text-muted-foreground text-xs mt-1">Messages</p>
        </Card>
        <Card className="border border-border/80 p-4 shadow-none">
          <p className="text-2xl font-bold">{shortlistCount ?? 0}</p>
          <p className="text-muted-foreground text-xs mt-1">Shortlisted</p>
        </Card>
        <Card className="border border-border/80 p-4 shadow-none">
          <p className="text-2xl font-bold">{(jobs ?? []).length}</p>
          <p className="text-muted-foreground text-xs mt-1">Jobs</p>
        </Card>
      </div>

      {shortlisted.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Shortlisted talent</h2>
          <div className="space-y-2">
            {shortlisted.map(item => {
              const talent = item.profiles
              if (!talent) return null
              return (
                <Link key={item.talent_id} href={`/talent/${item.talent_id}`}>
                  <Card className="border border-border/80 p-4 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 rounded-xl">
                        <AvatarImage src={talent.avatar_url ?? ''} alt={talent.full_name} />
                        <AvatarFallback className="rounded-xl text-lg font-bold">{talent.full_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{talent.full_name}</p>
                        <p className="text-muted-foreground text-xs truncate">
                          {talent.talent_skills.slice(0, 2).map(s => s.skill).join(' · ')}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Talent View Component ---
async function TalentActivity({ user, supabase }: { user: User, supabase: SupabaseClient }) {
  const [appsResult, outreachResult] = await Promise.all([
    supabase.from('applications').select('id, status, created_at, jobs!job_id(title, category, location)').eq('talent_id', user.id).order('created_at', { ascending: false }),
    supabase.from('outreach').select('id, message, status, created_at, profiles!hirer_id(full_name)').eq('talent_id', user.id).order('created_at', { ascending: false }),
  ])

  const applications = (appsResult.data ?? []) as unknown as AppRow[]
  const outreachItems = (outreachResult.data ?? []) as unknown as OutreachRow[]

  const timeline: ActivityItem[] = [
    ...applications.map(a => ({ type: 'application' as const, at: a.created_at, data: a })),
    ...outreachItems.map(o => ({ type: 'outreach' as const, at: o.created_at, data: o })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <div className="space-y-8 py-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your progress</p>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep track of applications and incoming outreach.</p>
      </div>
      {timeline.length === 0 ? (
        <Card className="p-8 text-center bg-muted/50 border-dashed">
          <p className="text-muted-foreground text-sm">No activity yet. Explore jobs to get started!</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {timeline.map(item => {
            const date = new Date(item.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            if (item.type === 'application') {
              const app = item.data
              return (
                <Card key={`app-${app.id}`} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><BriefcaseBusiness className="size-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{app.jobs?.title ?? 'Job'}</p>
                      <p className="text-muted-foreground text-xs">{date}</p>
                    </div>
                    <Badge variant={APP_STATUS_VARIANTS[app.status]}>{app.status}</Badge>
                  </div>
                </Card>
              )
            }
            const msg = item.data
            return (
              <Card key={`out-${msg.id}`} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Mail className="size-4" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Message from {msg.profiles?.full_name ?? 'Hirer'}</p>
                    <p className="text-muted-foreground text-xs truncate">{msg.message}</p>
                  </div>
                  <Badge variant={OUTREACH_STATUS_VARIANTS[msg.status]}>{msg.status}</Badge>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Main Page ---
export default async function CombinedActivityPage() {
  const localDemoMode = process.env.NODE_ENV === 'development' && (await cookies()).get('atlas_demo')?.value === '1'
  if (localDemoMode) return <DemoActivity />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const accountType = user.user_metadata?.account_type

  return (
    <div>
      {accountType === 'hirer' ? (
        <HirerActivity user={user} supabase={supabase} />
      ) : (
        <TalentActivity user={user} supabase={supabase} />
      )}
    </div>
  )
}
