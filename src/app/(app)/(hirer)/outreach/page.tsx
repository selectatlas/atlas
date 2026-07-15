import Link from 'next/link'
import { Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { OutreachStatus } from '@/types'

const STATUS_VARIANTS: Record<OutreachStatus, 'outline' | 'secondary' | 'default'> = {
  draft: 'outline',
  sent: 'secondary',
  viewed: 'default',
  responded: 'default',
}

type OutreachRow = {
  id: string
  message: string
  status: OutreachStatus
  created_at: string
  profiles: { id: string; full_name: string; avatar_url: string | null } | null
}

export default async function OutreachPage() {
  const [supabase, { userId }] = await Promise.all([createClient(), getSession()])

  const { data: outreach } = userId
    ? await supabase
        .from('outreach')
        .select('id, message, status, created_at, profiles!talent_id(id, full_name, avatar_url)')
        .eq('hirer_id', userId)
        .order('created_at', { ascending: false })
    : { data: null }

  const rows = (outreach ?? []) as unknown as OutreachRow[]

  return (
    <div className="space-y-8 py-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Workspace</p>
        <h1 className="text-2xl font-semibold tracking-tight">Outreach</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep track of every message and response.</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Send className="size-5" /></div>
          <p className="font-medium">No outreach sent yet</p>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Find the right talent and start the conversation.</p>
          <Link href="/search" className="text-primary text-sm hover:text-primary/80 font-medium">
            Find talent in Search
          </Link>
        </div>
      ) : (
        <div className="space-y-2 card-stagger">
          {rows.map(row => {
            const talent = row.profiles
            const date = new Date(row.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short',
            })
            return (
              <Card key={row.id} className="p-4">
                <div className="flex items-center gap-3">
                  {talent ? (
                    <Link href={`/talent/${talent.id}`}>
                      <Avatar className="h-10 w-10 rounded-xl">
                        <AvatarImage src={talent.avatar_url ?? ''} alt={talent.full_name} />
                        <AvatarFallback className="rounded-xl text-lg font-bold">
                          {talent.full_name[0]}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    {talent ? (
                      <Link href={`/talent/${talent.id}`} className="font-medium text-sm hover:text-primary transition-colors">
                        {talent.full_name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unknown talent</span>
                    )}
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">{row.message}</p>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <Badge variant={STATUS_VARIANTS[row.status]} className="text-xs">
                      {row.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs">{date}</span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
