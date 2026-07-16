'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { BadgeCheck, MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { AccountType, Category } from '@/types'

export type AccountRole = AccountType | 'admin'

export type AdminAccountRow = {
  id: string
  account_type: AccountType
  full_name: string
  email: string
  city: string | null
  country: string | null
  suspended_at: string | null
  suspension_reason: string | null
  verified_at: string | null
  verified_categories: Category[] | null
  created_at: string
  platform_admin_role: string | null
  display_role: AccountRole
}

type AdminAccountColumnHandlers = {
  busyId: string | null
  onRoleChange: (id: string, role: AccountRole) => void
  onSuspendRequest: (account: AdminAccountRow) => void
  onRestore: (account: AdminAccountRow) => void
  onDeleteRequest: (account: AdminAccountRow) => void
  onVerifyRequest: (account: AdminAccountRow) => void
  onUnverify: (account: AdminAccountRow) => void
}

export function useAdminAccountColumns({
  busyId,
  onRoleChange,
  onSuspendRequest,
  onRestore,
  onDeleteRequest,
  onVerifyRequest,
  onUnverify,
}: AdminAccountColumnHandlers) {
  const router = useRouter()

  return useMemo<ColumnDef<AdminAccountRow>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={value => row.toggleSelected(!!value)}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'full_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const account = row.original
        return (
          <div>
            <div className="flex items-center gap-1.5 font-medium">
              {account.full_name}
              {account.verified_at ? (
                <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Atlas Verified" />
              ) : null}
            </div>
            {account.city || account.country ? (
              <div className="text-xs text-muted-foreground">
                {[account.city, account.country].filter(Boolean).join(', ')}
              </div>
            ) : null}
          </div>
        )
      },
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'display_role',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => {
        const account = row.original
        return (
          <select
            aria-label={`Role for ${account.full_name}`}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            value={account.display_role}
            disabled={busyId === account.id}
            onChange={e => onRoleChange(account.id, e.target.value as AccountRole)}
          >
            <option value="hirer">Hirer</option>
            <option value="talent">Talent</option>
            <option value="admin">Admin</option>
          </select>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {new Date(row.original.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'status',
      accessorFn: row => (row.suspended_at ? 'suspended' : row.display_role === 'admin' ? 'admin' : 'active'),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const account = row.original
        if (account.suspended_at) return <Badge variant="destructive">Suspended</Badge>
        if (account.display_role === 'admin') return <Badge>Admin</Badge>
        return <Badge variant="outline">Active</Badge>
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const account = row.original
        const isAdmin = account.display_role === 'admin'

        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="size-8" disabled={busyId === account.id} />}>
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {account.account_type === 'talent' ? (
                  <>
                    <DropdownMenuItem onClick={() => router.push(`/talent/${account.id}`)}>
                      View account
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem onClick={() => void navigator.clipboard.writeText(account.id)}>
                  Copy user ID
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void navigator.clipboard.writeText(account.email)}>
                  Copy email
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {account.account_type === 'talent' && !account.verified_at ? (
                  <DropdownMenuItem onClick={() => onVerifyRequest(account)}>
                    Verify talent…
                  </DropdownMenuItem>
                ) : null}
                {account.account_type === 'talent' && account.verified_at ? (
                  <DropdownMenuItem onClick={() => onUnverify(account)}>
                    Remove verification
                  </DropdownMenuItem>
                ) : null}
                {!isAdmin && !account.suspended_at ? (
                  <DropdownMenuItem onClick={() => onSuspendRequest(account)}>
                    Suspend account
                  </DropdownMenuItem>
                ) : null}
                {!isAdmin && account.suspended_at ? (
                  <DropdownMenuItem onClick={() => onRestore(account)}>
                    Restore account
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isAdmin}
                  onClick={() => onDeleteRequest(account)}
                >
                  Delete account
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [busyId, onDeleteRequest, onRestore, onRoleChange, onSuspendRequest, onUnverify, onVerifyRequest, router])
}
