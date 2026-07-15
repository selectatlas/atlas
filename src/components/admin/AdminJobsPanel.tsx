'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminAddJobPanel } from '@/components/admin/AdminAddJobPanel'

type AdminJob = {
  id: string
  title: string
  category: string
  location: string
  status: string
  removed_at: string | null
  removal_reason: string | null
  created_at: string
  hirer: { full_name: string; email: string } | null
}

export function AdminJobsPanel() {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [filter, setFilter] = useState<'active' | 'removed' | 'all'>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (filter === 'removed') params.set('removed', 'true')
    if (filter === 'active') params.set('removed', 'false')
    try {
      const res = await fetch(`/api/admin/jobs?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as { jobs: AdminJob[] }
      setJobs(data.jobs)
    } catch {
      setError('Could not load jobs.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  async function moderate(id: string, action: 'remove' | 'restore') {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reasons[id] ?? null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Update failed')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <AdminAddJobPanel onCreated={() => { void load() }} />

      <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'active' ? 'default' : 'outline'} onClick={() => setFilter('active')}>Active</Button>
        <Button size="sm" variant={filter === 'removed' ? 'default' : 'outline'} onClick={() => setFilter('removed')}>Removed</Button>
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All</Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading jobs…</p> : null}

      <div className="space-y-3">
        {jobs.map(job => (
          <Card key={job.id}>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">{job.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {job.hirer?.full_name ?? 'Unknown hirer'} · {job.location}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{job.status}</Badge>
                {job.removed_at ? <Badge variant="destructive">Removed</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Posted {new Date(job.created_at).toLocaleDateString()} · {job.category.replaceAll('_', ' ')}
              </p>
              {job.removal_reason ? (
                <p className="text-sm text-muted-foreground">Reason: {job.removal_reason}</p>
              ) : null}
              {!job.removed_at ? (
                <>
                  <input
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Removal reason (required)"
                    value={reasons[job.id] ?? ''}
                    onChange={e => setReasons(prev => ({ ...prev, [job.id]: e.target.value }))}
                  />
                  <Button size="sm" variant="destructive" disabled={busyId === job.id} onClick={() => moderate(job.id, 'remove')}>
                    Remove job
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" disabled={busyId === job.id} onClick={() => moderate(job.id, 'restore')}>
                  Restore job
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </div>
  )
}
