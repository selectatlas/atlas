import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  Compass,
  Mail,
  MessageSquare,
  Search,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { getProfileCompletion } from '@/lib/profile-completion'
import { findThreadWithOther } from '@/lib/thread-lookup'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DemoActivity } from '@/components/talent/DemoActivity'
import { nameInitial } from '@/lib/display'
import type { Profile, TalentSkill, Job, ApplicationStatus, OutreachStatus, Category } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const APP_STATUS_VARIANTS: Record<ApplicationStatus, 'outline' | 'secondary' | 'default'> = {
  sent: 'outline', viewed: 'secondary', responded: 'default', shortlisted: 'default', hired: 'default',
}
const OUTREACH_STATUS_VARIANTS: Record<OutreachStatus, 'outline' | 'secondary' | 'default'> = {
  draft: 'outline', sent: 'secondary', viewed: 'default', responded: 'default',
}

type ThreadPreview = {
  id: string
  otherName: string
  otherAvatar: string | null
  lastMessage: string
  lastMessageAt: string
}

async function getRecentThreads(supabase: SupabaseClient, userId: string, limit = 3): Promise<ThreadPreview[]> {
  const { data: myThreads } = await supabase
    .from('thread_participants')
    .select('thread_id')
    .eq('profile_id', userId)

  const threadIds = (myThreads ?? []).map(t => t.thread_id as string)
  if (threadIds.length === 0) return []

  const { data: threads } = await supabase
    .from('message_threads')
    .select(`
      id,
      created_at,
      thread_participants(profile_id, profiles(full_name, avatar_url)),
      messages(id, content, created_at)
    `)
    .in('id', threadIds)
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { foreignTable: 'messages' })

  return (threads ?? [])
    .map(thread => {
      const msgs = thread.messages as Array<{ content: string; created_at: string }>
      const msg = msgs?.[0]
      const participants = thread.thread_participants as unknown as Array<{
        profile_id: string
        profiles: { full_name: string; avatar_url: string | null } | null
      }>
      const other = participants.find(p => p.profile_id !== userId)
      return {
        id: thread.id as string,
        otherName: other?.profiles?.full_name ?? 'Unknown',
        otherAvatar: other?.profiles?.avatar_url ?? null,
        lastMessage: msg?.content ?? 'No messages yet',
        lastMessageAt: msg?.created_at ?? (thread.created_at as string),
      }
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
    .slice(0, limit)
}

function DashboardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Dashboard</p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function StatCard({ value, label, href }: { value: number | string; label: string; href?: string }) {
  const content = (
    <Card className={`border border-border/80 p-4 shadow-none ${href ? 'transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35' : ''}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </Card>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string
  icon: typeof Search
  title: string
  description: string
}) {
  return (
    <Link href={href}>
      <Card className="border border-border/80 p-4 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </div>
      </Card>
    </Link>
  )
}

function ThreadList({ threads }: { threads: ThreadPreview[] }) {
  if (threads.length === 0) return null
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recent conversations</h2>
        <Link href="/messages" className="text-xs font-medium text-primary hover:underline">View all</Link>
      </div>
      <div className="space-y-2">
        {threads.map(thread => (
          <Link key={thread.id} href={`/messages/${thread.id}`}>
            <Card className="border border-border/80 p-4 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 rounded-xl">
                  <AvatarImage src={thread.otherAvatar ?? ''} alt={thread.otherName} />
                  <AvatarFallback className="rounded-xl text-sm font-bold">{nameInitial(thread.otherName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{thread.otherName}</p>
                  <p className="truncate text-xs text-muted-foreground">{thread.lastMessage}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

async function HirerDashboard({ userId, supabase }: { userId: string; supabase: SupabaseClient }) {
  const [
    { count: outreachCount },
    { count: shortlistCount },
    { count: likesCount },
    { count: jobsCount },
    { data: jobs },
    { data: shortlistRows },
    recentThreads,
  ] = await Promise.all([
    supabase.from('outreach').select('id', { count: 'exact', head: true }).eq('hirer_id', userId),
    supabase.from('shortlists').select('id', { count: 'exact', head: true }).eq('hirer_id', userId),
    supabase.from('profile_likes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('hirer_id', userId),
    supabase.from('jobs').select('id, title, category, location, status, created_at').eq('hirer_id', userId).order('created_at', { ascending: false }).limit(4),
    supabase.from('shortlists').select('talent_id, created_at, profiles!talent_id(full_name, avatar_url, talent_skills(skill))').eq('hirer_id', userId).order('created_at', { ascending: false }).limit(4),
    getRecentThreads(supabase, userId),
  ])

  const shortlisted = (shortlistRows ?? []) as unknown as Array<{
    talent_id: string
    profiles: (Profile & { talent_skills: TalentSkill[] }) | null
  }>

  return (
    <div className="space-y-8 py-2">
      <DashboardHeader
        title="Hirer workspace"
        subtitle="Pick up search, outreach, and hiring from one place."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={shortlistCount ?? 0} label="Shortlisted" href="/shortlists" />
        <StatCard value={likesCount ?? 0} label="Liked" href="/shortlists?tab=liked" />
        <StatCard value={outreachCount ?? 0} label="Outreach sent" href="/outreach" />
        <StatCard value={jobsCount ?? 0} label="Active jobs" href="/jobs" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <QuickAction href="/search" icon={Search} title="Search talent" description="Run a natural-language search or browse the directory." />
        <QuickAction href="/shortlists" icon={Bookmark} title="Saved talent" description="Review shortlisted and liked profiles in one place." />
        <QuickAction href="/jobs/new" icon={BriefcaseBusiness} title="Post a job" description="Publish a brief and collect applications." />
      </div>

      <ThreadList threads={recentThreads} />

      {(jobs ?? []).length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your jobs</h2>
            <Link href="/jobs" className="text-xs font-medium text-primary hover:underline">Manage jobs</Link>
          </div>
          <div className="space-y-2">
            {(jobs ?? []).map(job => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="border border-border/80 p-4 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.location}</p>
                    </div>
                    <Badge variant="outline">{job.status}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {shortlisted.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Shortlisted talent</h2>
            <Link href="/shortlists" className="text-xs font-medium text-primary hover:underline">View all saved</Link>
          </div>
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
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{talent.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
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

async function TalentDashboard({ userId, supabase }: { userId: string; supabase: SupabaseClient }) {
  const [profileResult, appsResult, outreachResult, recentThreads] = await Promise.all([
    supabase.from('profiles').select(PUBLIC_PROFILE_WITH_SKILLS).eq('id', userId).single(),
    supabase.from('applications').select('id, status, created_at, jobs!job_id(title, category, location)').eq('talent_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('outreach').select('id, message, status, created_at, hirer_id, profiles!hirer_id(full_name)').eq('talent_id', userId).order('created_at', { ascending: false }).limit(5),
    getRecentThreads(supabase, userId),
  ])

  const profile = profileResult.data as unknown as Profile & { talent_skills: TalentSkill[] }
  const completion = profile ? getProfileCompletion(profile) : null
  const applications = (appsResult.data ?? []) as unknown as Array<{
    id: string
    status: ApplicationStatus
    created_at: string
    jobs: { title: string; category: Category; location: string } | null
  }>
  const outreachItems = (outreachResult.data ?? []) as unknown as Array<{
    id: string
    message: string
    status: OutreachStatus
    created_at: string
    hirer_id: string
    profiles: { full_name: string } | null
  }>

  const outreachWithThreads = await Promise.all(
    outreachItems.map(async item => ({
      ...item,
      threadId: await findThreadWithOther(supabase, userId, item.hirer_id),
    })),
  )

  return (
    <div className="space-y-8 py-2">
      <DashboardHeader
        title="Talent workspace"
        subtitle="Finish your profile, track applications, and reply to hirers."
      />

      {completion && completion.percent < 100 && (
        <Card className="border border-primary/20 bg-primary/5 p-5 shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Profile {completion.percent}% complete</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {completion.missing[0] ?? 'Add the remaining details to improve discoverability.'}
              </p>
            </div>
            <Link
              href="/profile"
              className="inline-flex h-8 items-center justify-center rounded-xl border border-input bg-background px-3 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
            >
              Complete profile
            </Link>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completion.percent}%` }} />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard value={applications.length} label="Applications" />
        <StatCard value={outreachItems.length} label="Inbound outreach" />
        <StatCard value={recentThreads.length} label="Open threads" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <QuickAction href="/discover" icon={Compass} title="Discover jobs" description="Swipe or browse opportunities matched to your profile." />
        <QuickAction href="/messages" icon={MessageSquare} title="Open messages" description="Continue conversations with hirers." />
        <QuickAction href="/profile" icon={UserRound} title="Edit profile" description="Update skills, portfolio, and availability." />
      </div>

      <ThreadList threads={recentThreads} />

      {outreachWithThreads.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Recent outreach</h2>
          <div className="space-y-2">
            {outreachWithThreads.map(item => {
              const content = (
                <Card className="border border-border/80 p-4 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Mail className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">From {item.profiles?.full_name ?? 'Hirer'}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.message}</p>
                    </div>
                    <Badge variant={OUTREACH_STATUS_VARIANTS[item.status]}>{item.status}</Badge>
                  </div>
                </Card>
              )
              return item.threadId ? (
                <Link key={item.id} href={`/messages/${item.threadId}`}>{content}</Link>
              ) : (
                <div key={item.id}>{content}</div>
              )
            })}
          </div>
        </div>
      )}

      {applications.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Recent applications</h2>
          <div className="space-y-2">
            {applications.map(app => (
              <Card key={app.id} className="border border-border/80 p-4 shadow-none">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <BriefcaseBusiness className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{app.jobs?.title ?? 'Job'}</p>
                    <p className="text-xs text-muted-foreground">{app.jobs?.location}</p>
                  </div>
                  <Badge variant={APP_STATUS_VARIANTS[app.status]}>{app.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {applications.length === 0 && outreachWithThreads.length === 0 && (
        <Card className="flex min-h-[32vh] flex-col items-center justify-center border border-dashed border-border bg-card px-6 text-center shadow-none">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Sparkles className="size-5" />
          </div>
          <p className="font-medium">Your workspace is ready</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Discover jobs, polish your profile, and your applications and messages will show up here.
          </p>
          <Link
            href="/discover"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Find opportunities
          </Link>
        </Card>
      )}
    </div>
  )
}

export default async function HomePage() {
  const { userId, accountType, isLocalDemo } = await getSession()
  if (isLocalDemo) return <DemoActivity />
  if (!userId) redirect('/login')

  const supabase = await createClient()

  return accountType === 'hirer' ? (
    <HirerDashboard userId={userId} supabase={supabase} />
  ) : (
    <TalentDashboard userId={userId} supabase={supabase} />
  )
}
