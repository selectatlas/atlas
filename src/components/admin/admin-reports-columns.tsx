'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import type { ReportStatus } from '@/types'

export type AdminReportRow = {
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

export const reportStatusVariant: Record<ReportStatus, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  open: 'destructive',
  reviewing: 'secondary',
  resolved: 'default',
  dismissed: 'outline',
}

type AdminReportColumnHandlers = {
  busyId: string | null
  onReview: (report: AdminReportRow) => void
}

export function useAdminReportColumns({ busyId, onReview }: AdminReportColumnHandlers) {
  return useMemo<ColumnDef<AdminReportRow>[]>(() => [
    {
      accessorKey: 'reason',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reason" />,
      cell: ({ row }) => {
        const report = row.original
        return (
          <div>
            <div className="font-medium capitalize">{report.reason.replaceAll('_', ' ')}</div>
            {report.details ? (
              <div className="max-w-xs truncate text-xs text-muted-foreground">{report.details}</div>
            ) : null}
          </div>
        )
      },
    },
    {
      id: 'target',
      accessorFn: row => row.reported_profile?.full_name ?? row.reported_job?.title ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reported" />,
      cell: ({ row }) => {
        const report = row.original
        if (report.reported_profile) {
          return (
            <div>
              <div>{report.reported_profile.full_name}</div>
              <div className="text-xs capitalize text-muted-foreground">{report.reported_profile.account_type}</div>
            </div>
          )
        }
        if (report.reported_job) {
          return (
            <div>
              <div>{report.reported_job.title}</div>
              <div className="text-xs text-muted-foreground">Job</div>
            </div>
          )
        }
        return <span className="text-muted-foreground">—</span>
      },
    },
    {
      id: 'reporter',
      accessorFn: row => row.reporter?.full_name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Filed by" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.reporter?.full_name ?? 'Unknown'}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Filed" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {new Date(row.original.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <Badge variant={reportStatusVariant[row.original.status]}>{row.original.status}</Badge>
      ),
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          disabled={busyId === row.original.id}
          onClick={() => onReview(row.original)}
        >
          Review
        </Button>
      ),
    },
  ], [busyId, onReview])
}
