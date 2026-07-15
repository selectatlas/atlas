'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DataTable } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  reportStatusVariant,
  useAdminReportColumns,
  type AdminReportRow,
} from '@/components/admin/admin-reports-columns'
import type { ReportStatus } from '@/types'

export function AdminReportsPanel() {
  const [reports, setReports] = useState<AdminReportRow[]>([])
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reviewTarget, setReviewTarget] = useState<AdminReportRow | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const url = filter === 'open' ? '/api/admin/reports?status=open' : '/api/admin/reports'
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json() as { reports: AdminReportRow[] }
      setReports(data.reports)
    } catch {
      setError('Could not load reports.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load reports on mount and filter change
  useEffect(() => { void load() }, [load])

  const updateReport = useCallback(async (id: string, status: ReportStatus, notes: string) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, admin_notes: notes.trim() || null }),
      })
      if (!res.ok) throw new Error('Update failed')
      setReviewTarget(null)
      setReviewNotes('')
      await load()
    } catch {
      setError('Failed to update report.')
    } finally {
      setBusyId(null)
    }
  }, [load])

  const columns = useAdminReportColumns({
    busyId,
    onReview: report => {
      setReviewTarget(report)
      setReviewNotes(report.admin_notes ?? '')
    },
  })

  const actionable = reviewTarget !== null && (reviewTarget.status === 'open' || reviewTarget.status === 'reviewing')

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

      {!loading ? (
        <DataTable
          columns={columns}
          data={reports}
          filterColumn="reason"
          filterPlaceholder="Filter reports in view…"
          emptyMessage="No reports in this view."
        />
      ) : null}

      <Dialog open={reviewTarget !== null} onOpenChange={open => { if (!open) setReviewTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {reviewTarget ? reviewTarget.reason.replaceAll('_', ' ') : 'Report'}
            </DialogTitle>
            <DialogDescription>
              {reviewTarget
                ? `Filed ${new Date(reviewTarget.created_at).toLocaleString()} by ${reviewTarget.reporter?.full_name ?? 'Unknown'}`
                : null}
            </DialogDescription>
          </DialogHeader>

          {reviewTarget ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={reportStatusVariant[reviewTarget.status]}>{reviewTarget.status}</Badge>
                {reviewTarget.reported_profile ? (
                  <span className="text-sm text-muted-foreground">
                    Profile: <span className="text-foreground">{reviewTarget.reported_profile.full_name}</span> ({reviewTarget.reported_profile.account_type})
                  </span>
                ) : null}
                {reviewTarget.reported_job ? (
                  <span className="text-sm text-muted-foreground">
                    Job: <span className="text-foreground">{reviewTarget.reported_job.title}</span>
                  </span>
                ) : null}
              </div>
              {reviewTarget.details ? <p className="text-sm">{reviewTarget.details}</p> : null}
              <Textarea
                placeholder="Admin notes (optional)"
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                disabled={!actionable}
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Close</Button>
            {reviewTarget?.status === 'open' ? (
              <Button
                variant="outline"
                disabled={busyId !== null}
                onClick={() => reviewTarget && void updateReport(reviewTarget.id, 'reviewing', reviewNotes)}
              >
                Mark reviewing
              </Button>
            ) : null}
            {actionable ? (
              <>
                <Button
                  variant="outline"
                  disabled={busyId !== null}
                  onClick={() => reviewTarget && void updateReport(reviewTarget.id, 'dismissed', reviewNotes)}
                >
                  Dismiss
                </Button>
                <Button
                  disabled={busyId !== null}
                  onClick={() => reviewTarget && void updateReport(reviewTarget.id, 'resolved', reviewNotes)}
                >
                  Resolve
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
