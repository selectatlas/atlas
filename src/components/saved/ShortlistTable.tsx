'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { BriefcaseBusiness, ChevronDown, MessageSquare } from 'lucide-react'
import type { Profile, TalentSkill } from '@/types'
import { CATEGORY_LABELS } from '@/lib/skills'
import { nameInitial } from '@/lib/display'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { OutreachModal } from '@/components/outreach/OutreachModal'
import { VerifiedBadge } from '@/components/talent/VerifiedBadge'

type TalentWithSkills = Profile & { talent_skills: TalentSkill[] }

export type ShortlistTableRow = {
  talent_id: string
  created_at: string
  profiles: TalentWithSkills | null
}

export type ShortlistJobOption = { id: string; title: string }

type ShortlistEntry = {
  talent: TalentWithSkills
  savedAt: string
}

type OutreachTarget = {
  talent: TalentWithSkills
  job: ShortlistJobOption | null
}

interface ShortlistTableProps {
  rows: ShortlistTableRow[]
  jobs: ShortlistJobOption[]
}

export function ShortlistTable({ rows, jobs }: ShortlistTableProps) {
  const router = useRouter()
  const [outreach, setOutreach] = useState<OutreachTarget | null>(null)

  const entries = useMemo<ShortlistEntry[]>(
    () =>
      rows.flatMap(row =>
        row.profiles ? [{ talent: row.profiles, savedAt: row.created_at }] : [],
      ),
    [rows],
  )

  const columns = useMemo<ColumnDef<ShortlistEntry>[]>(
    () => [
      {
        id: 'verified',
        accessorFn: row => (row.talent.verified_at ? 1 : 0),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Verified" />,
        cell: ({ row }) => {
          const talent = row.original.talent
          return talent.verified_at ? (
            <VerifiedBadge
              verifiedAt={talent.verified_at}
              categories={talent.verified_categories}
            />
          ) : (
            <span className="text-xs text-muted-foreground">Not yet</span>
          )
        },
      },
      {
        id: 'name',
        accessorFn: row => row.talent.full_name,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        enableHiding: false,
        cell: ({ row }) => {
          const talent = row.original.talent
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-8 rounded-lg">
                <AvatarImage src={talent.avatar_url ?? ''} alt={talent.full_name} />
                <AvatarFallback className="rounded-lg text-sm font-bold">
                  {nameInitial(talent.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <Link
                  href={`/talent/${talent.id}`}
                  className="block truncate text-sm font-semibold hover:text-primary"
                >
                  {talent.full_name}
                </Link>
                {talent.headline && (
                  <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                    {talent.headline}
                  </p>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'category',
        accessorFn: row => {
          const category = row.talent.talent_skills[0]?.category
          return category ? CATEGORY_LABELS[category] : ''
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
        cell: ({ getValue }) => {
          const label = getValue<string>()
          return label ? (
            <Badge variant="secondary" className="text-[11px]">{label}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Not listed</span>
          )
        },
      },
      {
        id: 'skills',
        enableSorting: false,
        header: () => <span>Top skills</span>,
        cell: ({ row }) => {
          const skills = row.original.talent.talent_skills
          if (skills.length === 0) {
            return <span className="text-xs text-muted-foreground">Not listed</span>
          }
          return (
            <div className="flex flex-wrap items-center gap-1">
              {skills.slice(0, 3).map(skill => (
                <Badge key={skill.id} variant="outline" className="text-[10px]">
                  {skill.skill}
                </Badge>
              ))}
              {skills.length > 3 && (
                <span className="text-[11px] text-muted-foreground">+{skills.length - 3}</span>
              )}
            </div>
          )
        },
      },
      {
        id: 'rate',
        accessorFn: row => row.talent.rates?.split('/')[0].trim() ?? '',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Rate" />,
        cell: ({ getValue }) => {
          const rate = getValue<string>()
          return rate ? (
            <span className="whitespace-nowrap text-xs font-medium">{rate}</span>
          ) : (
            <span className="text-xs text-muted-foreground">On request</span>
          )
        },
      },
      {
        id: 'availability',
        accessorFn: row => row.talent.availability ?? '',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Availability" />,
        cell: ({ getValue }) => {
          const availability = getValue<string>()
          return availability ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="max-w-[160px] truncate">{availability}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not listed</span>
          )
        },
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
          const talent = row.original.talent
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setOutreach({ talent, job: null })}
              >
                <MessageSquare className="size-3.5" />
                Message
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="sm" className="gap-1.5" />}
                >
                  <BriefcaseBusiness className="size-3.5" />
                  Invite
                  <ChevronDown className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Invite to a job</DropdownMenuLabel>
                  {jobs.length > 0 ? (
                    jobs.map(job => (
                      <DropdownMenuItem
                        key={job.id}
                        onClick={() => setOutreach({ talent, job })}
                      >
                        <span className="max-w-[220px] truncate">{job.title}</span>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem onClick={() => router.push('/jobs/new')}>
                      No open jobs yet. Post one
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [jobs, router],
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={entries}
        filterColumn="name"
        filterPlaceholder="Filter by name"
        emptyMessage="No shortlisted talent yet."
      />
      <OutreachModal
        talent={outreach?.talent ?? null}
        job={outreach?.job ?? null}
        onClose={() => setOutreach(null)}
        onSent={() => setOutreach(null)}
      />
    </>
  )
}
