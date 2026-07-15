'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type AdminUser = {
  id: string
  account_type: string
  full_name: string
  email: string
  city: string | null
  country: string | null
  suspended_at: string | null
  suspension_reason: string | null
  created_at: string
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'suspended'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (filter === 'suspended') params.set('suspended', 'true')
    try {
      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as { users: AdminUser[] }
      setUsers(data.users)
    } catch {
      setError('Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [query, filter])

  useEffect(() => {
    const timer = setTimeout(() => { void load() }, 250)
    return () => clearTimeout(timer)
  }, [load])

  async function moderate(id: string, action: 'suspend' | 'unsuspend') {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reasons[id] ?? null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Update failed')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
          placeholder="Search by name or email"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="flex gap-2">
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All</Button>
          <Button size="sm" variant={filter === 'suspended' ? 'default' : 'outline'} onClick={() => setFilter('suspended')}>Suspended</Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading users…</p> : null}

      <div className="space-y-3">
        {users.map(user => (
          <Card key={user.id}>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">{user.full_name}</CardTitle>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{user.account_type}</Badge>
                {user.suspended_at ? <Badge variant="destructive">Suspended</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Joined {new Date(user.created_at).toLocaleDateString()}
                {user.city || user.country ? ` · ${[user.city, user.country].filter(Boolean).join(', ')}` : ''}
              </p>
              {user.suspension_reason ? (
                <p className="text-sm text-muted-foreground">Reason: {user.suspension_reason}</p>
              ) : null}
              {!user.suspended_at ? (
                <>
                  <input
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Suspension reason (required)"
                    value={reasons[user.id] ?? ''}
                    onChange={e => setReasons(prev => ({ ...prev, [user.id]: e.target.value }))}
                  />
                  <Button size="sm" variant="destructive" disabled={busyId === user.id} onClick={() => moderate(user.id, 'suspend')}>
                    Suspend account
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" disabled={busyId === user.id} onClick={() => moderate(user.id, 'unsuspend')}>
                  Restore account
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
