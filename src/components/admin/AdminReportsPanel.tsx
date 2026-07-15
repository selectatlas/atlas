'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReportStatus } from '@/types'

type AdminReport = {
  id: string
  reason: string
  details: string | null
  status: ReportStatus
  admin_notes: string | null
  created_at: string
  reporter: { full_name: string; email: string; account_type: string } | null
  reported_profile: { id: string; full_name: string; email: string; account_type: string } | null
  reported_job: { id: string; title: string; status: string } | null
}

const statusVariant: Record<ReportStatus, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  open: 'destructive',
  reviewing: 'secondary',
  resolved: 'default',
  dismissed: 'outline',
}

export function AdminReportsPanel() {
  const [reports, setReports] = useState<AdminReport[]>([])
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const url = filter === 'open' ? '/api/admin/reports?status=open' : '/api/admin/reports'
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json() as { reports: AdminReport[] }
      setReports(data.reports)
    } catch {
      setError('Could not load reports.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  async function updateReport(id: string, status: ReportStatus) {
    setBusyId(id)
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, admin_notes: notes[id] ?? null }),
      })
      if (!res.ok) throw new Error('Update failed')
      await load()
    } catch {
      setError('Failed to update report.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={filter === 'open' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('open')}>
          Open
        </Button>
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
          All
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading reports…</p> : null}

      {!loading && reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports in this view.</p>
      ) : null}

      <div className="space-y-3">
        {reports.map(report => (
          <Card key={report.id}>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base capitalize">{report.reason.replaceAll('_', ' ')}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Filed {new Date(report.created_at).toLocaleString()} by {report.reporter?.full_name ?? 'Unknown'}
                </p>
              </div>
              <Badge variant={statusVariant[report.status]}>{report.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.details ? <p className="text-sm">{report.details}</p> : null}
              {report.reported_profile ? (
                <p className="text-sm text-muted-foreground">
                  Profile: <span className="text-foreground">{report.reported_profile.full_name}</span> ({report.reported_profile.account_type})
                </p>
              ) : null}
              {report.reported_job ? (
                <p className="text-sm text-muted-foreground">
                  Job: <span className="text-foreground">{report.reported_job.title}</span>
                </p>
              ) : null}
              <textarea
                className="min-h-16 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Admin notes (optional)"
                value={notes[report.id] ?? report.admin_notes ?? ''}
                onChange={e => setNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
              />
              {report.status === 'open' || report.status === 'reviewing' ? (
                <div className="flex flex-wrap gap-2">
                  {report.status === 'open' ? (
                    <Button size="sm" variant="outline" disabled={busyId === report.id} onClick={() => updateReport(report.id, 'reviewing')}>
                      Mark reviewing
                    </Button>
                  ) : null}
                  <Button size="sm" disabled={busyId === report.id} onClick={() => updateReport(report.id, 'resolved')}>
                    Resolve
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === report.id} onClick={() => updateReport(report.id, 'dismissed')}>
                    Dismiss
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
