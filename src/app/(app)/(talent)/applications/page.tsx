import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Send } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ApplicationRow, type ApplicationRowData } from '@/components/talent/ApplicationRow'
import { DemoApplicationsList } from '@/components/talent/DemoApplicationsList'
import { getSession } from '@/lib/auth'
import { logEvent } from '@/lib/log'
import { createClient } from '@/lib/supabase/server'
import type { ApplicationStatus, Category } from '@/types'

const PAGE_SIZE = 50

type ApplicationQueryRow = {
  id: string
  status: ApplicationStatus
  created_at: string
  note: string | null
  talent_seen_status: string | null
  jobs: { id: string; title: string; category: Category; location: string; removed_at: string | null } | null
}

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { userId, isLocalDemo } = await getSession()
  if (isLocalDemo) return <DemoApplicationsList />
  if (!userId) redirect('/login')

  const params = await searchParams
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('applications')
    .select('id, status, created_at, note, talent_seen_status, jobs(id, title, category, location, removed_at)', { count: 'exact' })
    .eq('talent_id', userId)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) {
    logEvent('error', 'applications_page_query_failed', { code: error.code })
  }

  const applications: ApplicationRowData[] = ((data ?? []) as unknown as ApplicationQueryRow[]).map(row => ({
    id: row.id,
    status: row.status,
    created_at: row.created_at,
    note: row.note,
    statusIsNew: row.talent_seen_status !== null ? row.talent_seen_status !== row.status : false,
    job: row.jobs
      ? { id: row.jobs.id, title: row.jobs.title, category: row.jobs.category, location: row.jobs.location, removed: row.jobs.removed_at !== null }
      : null,
  }))

  // Acknowledge status changes after reading (not before), so statusIsNew
  // dots render once on this view and the inbox badge clears. Best-effort:
  // the migration may not be applied yet on older environments.
  if (applications.length > 0) {
    const { error: seenError } = await supabase.rpc('mark_application_statuses_seen')
    if (seenError) logEvent('warn', 'applications_mark_seen_failed', { code: seenError.code })
  }

  const total = count ?? applications.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} {total === 1 ? 'application' : 'applications'} submitted.</p>
      </div>

      {applications.length === 0 ? (
        <Card className="flex min-h-[32vh] flex-col items-center justify-center border border-dashed border-border bg-card px-6 text-center shadow-none">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Send className="size-5" />
          </div>
          <p className="font-medium">No applications yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            When you apply for jobs, they show up here so you can track where each one stands.
          </p>
          <Link
            href="/discover"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Discover jobs
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {applications.map(application => (
            <ApplicationRow key={application.id} application={application} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link className="font-medium text-primary hover:underline" href={`/applications?page=${page - 1}`}>Previous</Link>
          ) : <span />}
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link className="font-medium text-primary hover:underline" href={`/applications?page=${page + 1}`}>Next</Link>
          ) : <span />}
        </div>
      )}
    </div>
  )
}
