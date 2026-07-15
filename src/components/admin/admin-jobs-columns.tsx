'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type AdminJobRow = {
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

type AdminJobColumnHandlers = {
  busyId: string | null
  onRemoveRequest: (job: AdminJobRow) => void
  onRestore: (job: AdminJobRow) => void
}

export function useAdminJobColumns({
  busyId,
  onRemoveRequest,
  onRestore,
}: AdminJobColumnHandlers) {
  return useMemo<ColumnDef<AdminJobRow>[]>(() => [
    {
      accessorKey: 'title',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Job" />,
      cell: ({ row }) => {
        const job = row.original
        return (
          <div>
            <div className="font-medium">{job.title}</div>
            <div className="text-xs text-muted-foreground">
              {job.hirer?.full_name ?? 'Unknown hirer'}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'category',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ row }) => (
        <span className="capitalize text-muted-foreground">
          {row.original.category.replaceAll('_', ' ')}
        </span>
      ),
    },
    {
      accessorKey: 'location',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.location}</span>,
    },
    {
      id: 'status',
      accessorFn: row => (row.removed_at ? 'removed' : row.status),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const job = row.original
        if (job.removed_at) {
          return (
            <div className="space-y-1">
              <Badge variant="destructive">Removed</Badge>
              {job.removal_reason ? (
                <div className="text-xs text-muted-foreground">{job.removal_reason}</div>
              ) : null}
            </div>
          )
        }
        return <Badge variant="outline">{job.status}</Badge>
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Posted" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {new Date(row.original.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const job = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="size-8" disabled={busyId === job.id} />}>
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => void navigator.clipboard.writeText(job.id)}>
                  Copy job ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {job.removed_at ? (
                  <DropdownMenuItem onClick={() => onRestore(job)}>
                    Restore job
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem variant="destructive" onClick={() => onRemoveRequest(job)}>
                    Remove job
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [busyId, onRemoveRequest, onRestore])
}
