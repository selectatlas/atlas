import Link from 'next/link'
import { Bookmark, Heart } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Card } from '@/components/ui/card'
import { BroadcastDialog } from '@/components/saved/BroadcastDialog'
import { SavedTalentRow } from '@/components/saved/SavedTalentRow'
import { ShortlistTable, type ShortlistJobOption } from '@/components/saved/ShortlistTable'
import type { Profile, TalentSkill } from '@/types'

const tabs = [
  { id: 'shortlisted', label: 'Shortlisted', href: '/shortlists', icon: Bookmark },
  { id: 'liked', label: 'Liked', href: '/shortlists?tab=liked', icon: Heart },
] as const

type SavedRow = {
  talent_id: string
  created_at: string
  profiles: (Profile & { talent_skills: TalentSkill[] }) | null
}

interface SavedTalentViewProps {
  activeTab: 'shortlisted' | 'liked'
  shortlisted: SavedRow[]
  liked: SavedRow[]
  /** The hirer's open jobs, powering the Invite-to-job action in the comparison table. */
  jobs?: ShortlistJobOption[]
}

export function SavedTalentView({ activeTab, shortlisted, liked, jobs = [] }: SavedTalentViewProps) {
  const rows = activeTab === 'liked' ? liked : shortlisted

  return (
    <div className="space-y-8">
      <PageShell />

      <div className="flex gap-2 rounded-xl border border-border/80 bg-card p-1">
        {tabs.map(({ id, label, href, icon: Icon }) => {
          const active = activeTab === id
          return (
            <Link
              key={id}
              href={href}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="size-4" strokeWidth={active ? 2.2 : 1.8} />
              {label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-primary-foreground/15' : 'bg-muted'}`}>
                {id === 'liked' ? liked.length : shortlisted.length}
              </span>
            </Link>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {activeTab === 'liked' ? <Heart className="size-5" /> : <Bookmark className="size-5" />}
          </div>
          <p className="font-medium">
            {activeTab === 'liked' ? 'No liked profiles yet' : 'No shortlisted talent yet'}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {activeTab === 'liked'
              ? 'Tap the heart on a talent profile to save it here for later.'
              : 'Tap the bookmark on a talent profile to add them to your shortlist.'}
          </p>
          <Link href="/search" className="mt-5 text-sm font-semibold text-primary hover:underline">
            Browse talent in Search
          </Link>
        </div>
      ) : (
        <>
          {activeTab === 'shortlisted' && (
            <div className="flex justify-end">
              <BroadcastDialog recipientCount={shortlisted.length} />
            </div>
          )}

          {/* Card list: the mobile default, and the only Liked-tab layout. */}
          <div className={`space-y-2 card-stagger ${activeTab === 'shortlisted' ? 'md:hidden' : ''}`}>
            {rows.map(row => {
              const talent = row.profiles
              if (!talent) return null
              return (
                <SavedTalentRow
                  key={row.talent_id}
                  talent={talent}
                  savedAt={row.created_at}
                />
              )
            })}
          </div>

          {/* Comparison table: desktop-only view of the shortlist. */}
          {activeTab === 'shortlisted' && (
            <div className="hidden md:block">
              <ShortlistTable rows={rows} jobs={jobs} />
            </div>
          )}
        </>
      )}

      {activeTab === 'shortlisted' && liked.length > 0 && rows.length > 0 && (
        <Card className="border border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground shadow-none">
          You have {liked.length} liked {liked.length === 1 ? 'profile' : 'profiles'}.
          {' '}
          <Link href="/shortlists?tab=liked" className="font-medium text-primary hover:underline">
            View liked talent
          </Link>
        </Card>
      )}

      {activeTab === 'liked' && shortlisted.length > 0 && rows.length > 0 && (
        <Card className="border border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground shadow-none">
          You have {shortlisted.length} shortlisted {shortlisted.length === 1 ? 'person' : 'people'}.
          {' '}
          <Link href="/shortlists" className="font-medium text-primary hover:underline">
            View shortlist
          </Link>
        </Card>
      )}
    </div>
  )
}
