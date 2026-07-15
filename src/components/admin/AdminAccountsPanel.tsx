'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { AccountType } from '@/types'

type AdminAccount = {
  id: string
  account_type: AccountType
  full_name: string
  email: string
  city: string | null
  country: string | null
  suspended_at: string | null
  suspension_reason: string | null
  created_at: string
}

export function AdminAccountsPanel() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | AccountType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'suspended'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (roleFilter !== 'all') params.set('account_type', roleFilter)
    if (statusFilter === 'suspended') params.set('suspended', 'true')
    params.set('limit', '100')
    try {
      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as { users: AdminAccount[] }
      setAccounts(data.users)
    } catch {
      setError('Could not load accounts.')
    } finally {
      setLoading(false)
    }
  }, [query, roleFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => { void load() }, 250)
    return () => clearTimeout(timer)
  }, [load])

  async function changeRole(id: string, accountType: AccountType) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_account_type', account_type: accountType }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Role update failed')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role.')
    } finally {
      setBusyId(null)
    }
  }

  async function moderate(id: string, action: 'suspend' | 'unsuspend') {
    setBusyId(id)
    setError(null)
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
      setError(err instanceof Error ? err.message : 'Failed to update account.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
          placeholder="Search by name or email"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={roleFilter === 'all' ? 'default' : 'outline'} onClick={() => setRoleFilter('all')}>All roles</Button>
          <Button size="sm" variant={roleFilter === 'hirer' ? 'default' : 'outline'} onClick={() => setRoleFilter('hirer')}>Hirers</Button>
          <Button size="sm" variant={roleFilter === 'talent' ? 'default' : 'outline'} onClick={() => setRoleFilter('talent')}>Talent</Button>
          <Button size="sm" variant={statusFilter === 'suspended' ? 'default' : 'outline'} onClick={() => setStatusFilter(prev => prev === 'suspended' ? 'all' : 'suspended')}>
            Suspended
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading accounts…</p> : null}

      {!loading && accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts match your filters.</p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(account => (
                  <tr key={account.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{account.full_name}</div>
                      {account.city || account.country ? (
                        <div className="text-xs text-muted-foreground">
                          {[account.city, account.country].filter(Boolean).join(', ')}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{account.email}</td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Role for ${account.full_name}`}
                        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                        value={account.account_type}
                        disabled={busyId === account.id}
                        onChange={e => void changeRole(account.id, e.target.value as AccountType)}
                      >
                        <option value="hirer">Hirer</option>
                        <option value="talent">Talent</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(account.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {account.suspended_at ? (
                        <Badge variant="destructive">Suspended</Badge>
                      ) : (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!account.suspended_at ? (
                        <div className="flex min-w-[220px] flex-col gap-2">
                          <input
                            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                            placeholder="Suspension reason"
                            value={reasons[account.id] ?? ''}
                            onChange={e => setReasons(prev => ({ ...prev, [account.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busyId === account.id}
                            onClick={() => moderate(account.id, 'suspend')}
                          >
                            Suspend
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {account.suspension_reason ? (
                            <p className="text-xs text-muted-foreground">{account.suspension_reason}</p>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === account.id}
                            onClick={() => moderate(account.id, 'unsuspend')}
                          >
                            Restore
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
