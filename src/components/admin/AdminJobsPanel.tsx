'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AdminAddJobPanel } from '@/components/admin/AdminAddJobPanel'
import { useAdminJobColumns, type AdminJobRow } from '@/components/admin/admin-jobs-columns'

export function AdminJobsPanel() {
  const [jobs, setJobs] = useState<AdminJobRow[]>([])
  const [filter, setFilter] = useState<'active' | 'removed' | 'all'>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<AdminJobRow | null>(null)
  const [removeReason, setRemoveReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (filter === 'removed') params.set('removed', 'true')
    if (filter === 'active') params.set('removed', 'false')
    try {
      const res = await fetch(`/api/admin/jobs?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as { jobs: AdminJobRow[] }
      setJobs(data.jobs)
    } catch {
      setError('Could not load jobs.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load jobs on mount and filter change
  useEffect(() => { void load() }, [load])

  const moderate = useCallback(async (id: string, action: 'remove' | 'restore', reason?: string) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason ?? null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Update failed')
      }
      setRemoveTarget(null)
      setRemoveReason('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job.')
    } finally {
      setBusyId(null)
    }
  }, [load])

  const columns = useAdminJobColumns({
    busyId,
    onRemoveRequest: job => {
      setRemoveTarget(job)
      setRemoveReason('')
    },
    onRestore: job => { void moderate(job.id, 'restore') },
  })

  return (
    <div className="space-y-6">
      <AdminAddJobPanel onCreated={() => { void load() }} />

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={filter === 'active' ? 'default' : 'outline'} onClick={() => setFilter('active')}>Active</Button>
          <Button size="sm" variant={filter === 'removed' ? 'default' : 'outline'} onClick={() => setFilter('removed')}>Removed</Button>
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All</Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">Loading jobs…</p> : null}

        {!loading ? (
          <DataTable
            columns={columns}
            data={jobs}
            filterColumn="title"
            filterPlaceholder="Filter jobs in view…"
            emptyMessage="No jobs in this view."
          />
        ) : null}
      </div>

      <Dialog open={removeTarget !== null} onOpenChange={open => { if (!open) setRemoveTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove job</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `Remove “${removeTarget.title}”? It will be hidden from talent immediately and stop appearing in search and discovery. ${removeTarget.hirer?.full_name ?? 'The hirer'} keeps the record, and you can restore it later.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Removal reason (required)"
            value={removeReason}
            onChange={e => setRemoveReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!removeReason.trim() || busyId !== null}
              onClick={() => removeTarget && void moderate(removeTarget.id, 'remove', removeReason.trim())}
            >
              Remove job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
