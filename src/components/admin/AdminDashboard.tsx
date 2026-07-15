'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BriefcaseBusiness, Flag, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Metrics = {
  users_total: number
  hirers: number
  talent: number
  jobs: number
  applications: number
  outreach: number
  messages: number
  open_reports: number
  suspended_users: number
  removed_jobs: number
}

const statCards = [
  { key: 'users_total' as const, label: 'Total accounts', href: '/admin/accounts' },
  { key: 'open_reports' as const, label: 'Open reports', href: '/admin/reports', alert: true },
  { key: 'jobs' as const, label: 'Jobs posted', href: '/admin/jobs' },
  { key: 'messages' as const, label: 'Messages sent', href: null },
]

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(async res => {
        if (!res.ok) throw new Error('Failed to load metrics')
        return res.json() as Promise<{ metrics: Metrics }>
      })
      .then(data => setMetrics(data.metrics))
      .catch(() => setError('Could not load platform metrics.'))
  }, [])

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!metrics) {
    return <p className="text-sm text-muted-foreground">Loading metrics…</p>
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(card => {
          const value = metrics[card.key]
          const content = (
            <Card key={card.key} className={card.alert && value > 0 ? 'ring-destructive/30' : undefined}>
              <CardHeader className="pb-2">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
              </CardHeader>
              {card.alert && value > 0 ? (
                <CardContent className="pt-0">
                  <Badge variant="destructive">Needs review</Badge>
                </CardContent>
              ) : null}
            </Card>
          )
          return card.href ? (
            <Link key={card.key} href={card.href} className="block transition-opacity hover:opacity-90">
              {content}
            </Link>
          ) : (
            content
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Marketplace split
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Hirers</span><span className="font-medium tabular-nums">{metrics.hirers}</span></div>
            <div className="flex justify-between"><span>Talent</span><span className="font-medium tabular-nums">{metrics.talent}</span></div>
            <div className="flex justify-between"><span>Suspended</span><span className="font-medium tabular-nums">{metrics.suspended_users}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BriefcaseBusiness className="size-4" />
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Applications</span><span className="font-medium tabular-nums">{metrics.applications}</span></div>
            <div className="flex justify-between"><span>Outreach</span><span className="font-medium tabular-nums">{metrics.outreach}</span></div>
            <div className="flex justify-between"><span>Removed jobs</span><span className="font-medium tabular-nums">{metrics.removed_jobs}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flag className="size-4" />
              Trust & safety
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Review open reports first — they surface harassment, scams, and impersonation.</p>
            <Link href="/admin/reports" className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline">
              Open reports queue
              <AlertTriangle className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
