'use client'

import { useTransition } from 'react'
import { BriefcaseBusiness, ChevronsUpDown, ShieldCheck, UserRound } from 'lucide-react'
import { switchAdminView, type AdminView } from '@/app/actions/admin-view'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function AdminViewSwitcher() {
  const [isPending, startTransition] = useTransition()

  const switchTo = (view: AdminView) => {
    startTransition(async () => {
      await switchAdminView(view)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            disabled={isPending}
            className="w-full justify-between gap-2 px-3 text-sm font-medium"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-4 shrink-0" strokeWidth={1.8} />
          <span className="truncate">Admin account</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => switchTo('hirer')}>
          <BriefcaseBusiness className="size-4" strokeWidth={1.8} />
          Hirer account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => switchTo('talent')}>
          <UserRound className="size-4" strokeWidth={1.8} />
          Talent account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
