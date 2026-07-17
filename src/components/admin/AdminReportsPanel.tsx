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

  // Resolution with consequences: act on the reported user/job through the
  // existing admin endpoints, then resolve the report with the action noted,
  // so resolving is never just a status flip.
  const actOnReport = useCallback(async (report: AdminReportRow, action: 'suspend' | 'remove_job') => {
    setBusyId(report.id)
    setError(null)
    const reason = reviewNotes.trim() || `Report: ${report.reason.replaceAll('_', ' ')}`
    try {
      const res = action === 'suspend'
        ? await fetch(`/api/admin/users/${report.reported_profile?.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'suspend', reason }),
          })
        : await fetch(`/api/admin/jobs/${report.reported_job?.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'remove', reason }),
          })
      if (!res.ok) throw new Error('Action failed')
      const actionNote = action === 'suspend' ? 'Action taken: user suspended.' : 'Action taken: job removed.'
      await updateReport(report.id, 'resolved', [reviewNotes.trim(), actionNote].filter(Boolean).join(' '))
    } catch {
      setError(action === 'suspend' ? 'Failed to suspend the reported user.' : 'Failed to remove the reported job.')
      setBusyId(null)
    }
  }, [reviewNotes, updateReport])

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
                {reviewTarget?.reported_profile ? (
                  <Button
                    variant="destructive"
                    disabled={busyId !== null}
                    onClick={() => {
                      if (reviewTarget && window.confirm('Suspend this user and resolve the report?')) {
                        void actOnReport(reviewTarget, 'suspend')
                      }
                    }}
                  >
                    Suspend user
                  </Button>
                ) : null}
                {reviewTarget?.reported_job ? (
                  <Button
                    variant="destructive"
                    disabled={busyId !== null}
                    onClick={() => {
                      if (reviewTarget && window.confirm('Remove this job and resolve the report?')) {
                        void actOnReport(reviewTarget, 'remove_job')
                      }
                    }}
                  >
                    Remove job
                  </Button>
                ) : null}
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
