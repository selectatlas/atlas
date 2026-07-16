'use client'

import Link from 'next/link'
import { Archive, ArchiveRestore, BriefcaseBusiness, ChevronLeft, Info, MoreHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppShell } from '@/components/layout/app-shell-context'
import { nameInitial } from '@/lib/display'
import type { ThreadOrigin, ThreadOther } from '@/components/messages/types'

export function ThreadHeader({
  other,
  origin,
  archived,
  onToggleArchive,
  onToggleDetails,
}: {
  other: ThreadOther | null
  origin: ThreadOrigin
  archived: boolean
  onToggleArchive: () => void
  onToggleDetails: () => void
}) {
  const { accountType } = useAppShell()
  const name = other?.full_name ?? 'Conversation'
  const profileHref =
    accountType === 'hirer' && other?.profile_id ? `/talent/${other.profile_id}` : null

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border/80 bg-background px-3 py-2.5 sm:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        aria-label="Back to messages"
        render={<Link href="/messages" />}
      >
        <ChevronLeft className="size-4" />
      </Button>

      {other && (
        <>
          <Avatar className="size-8 shrink-0 rounded-lg">
            <AvatarImage src={other.avatar_url ?? ''} alt={name} />
            <AvatarFallback className="rounded-lg text-sm font-bold">{nameInitial(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            {profileHref ? (
              <Link href={profileHref} className="block truncate text-sm font-semibold hover:underline">
                {name}
              </Link>
            ) : (
              <span className="block truncate text-sm font-semibold">{name}</span>
            )}
            {origin.job_title && (
              <Badge variant="secondary" className="mt-0.5 hidden max-w-56 gap-1 rounded-md px-1.5 py-0 text-[10px] font-medium sm:inline-flex">
                <BriefcaseBusiness className="size-2.5 shrink-0" />
                <span className="truncate">Via {origin.job_title}</span>
              </Badge>
            )}
          </div>
        </>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Conversation details"
          onClick={onToggleDetails}
        >
          <Info className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label="Conversation actions" />}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onToggleArchive}>
              {archived ? (
                <>
                  <ArchiveRestore className="size-4" />
                  Move to Open
                </>
              ) : (
                <>
                  <Archive className="size-4" />
                  Archive conversation
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
