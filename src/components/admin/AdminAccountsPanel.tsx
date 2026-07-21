'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/ui/data-table'
import { CATEGORY_LABELS } from '@/lib/skills'
import type { MembershipTier } from '@/lib/membership'
import type { Category } from '@/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useAdminAccountColumns,
  type AccountRole,
  type AdminAccountRow,
} from '@/components/admin/admin-accounts-columns'

const ACCOUNT_FILTERS = {
  all: 'All roles',
  hirer: 'Hirers',
  talent: 'Talent',
  admin: 'Admins',
  suspended: 'Suspended',
} as const

type AccountFilter = keyof typeof ACCOUNT_FILTERS

const ROLE_OPTIONS = {
  hirer: 'Hirer',
  talent: 'Talent',
  admin: 'Admin',
} as const

export function AdminAccountsPanel() {
  const [accounts, setAccounts] = useState<AdminAccountRow[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AccountFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<AdminAccountRow | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AdminAccountRow | null>(null)
  const [verifyTarget, setVerifyTarget] = useState<AdminAccountRow | null>(null)
  const [verifyCategories, setVerifyCategories] = useState<Category[]>([])
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<AdminAccountRow[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<AccountRole>('hirer')
  const [addError, setAddError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (filter === 'admin') params.set('role', 'admin')
    else if (filter === 'suspended') params.set('suspended', 'true')
    else if (filter !== 'all') params.set('account_type', filter)
    params.set('limit', '100')
    try {
      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as { users: AdminAccountRow[] }
      setAccounts(data.users)
    } catch {
      setError('Could not load accounts.')
    } finally {
      setLoading(false)
    }
  }, [query, filter])

  useEffect(() => {
    const timer = setTimeout(() => { void load() }, 250)
    return () => clearTimeout(timer)
  }, [load])

  const changeRole = useCallback(async (id: string, role: AccountRole) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_role', role }),
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
  }, [load])

  const suspendAccount = useCallback(async (account: AdminAccountRow, reason: string) => {
    setBusyId(account.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suspend', reason }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Update failed')
      }
      setSuspendTarget(null)
      setSuspendReason('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suspend account.')
    } finally {
      setBusyId(null)
    }
  }, [load])

  const restoreAccount = useCallback(async (account: AdminAccountRow) => {
    setBusyId(account.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unsuspend' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Update failed')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore account.')
    } finally {
      setBusyId(null)
    }
  }, [load])

  const setMembershipTier = useCallback(async (account: AdminAccountRow, tier: MembershipTier) => {
    setBusyId(account.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_membership_tier', tier }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Tier update failed')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update membership tier.')
    } finally {
      setBusyId(null)
    }
  }, [load])

  const setVerification = useCallback(async (account: AdminAccountRow, verified: boolean, categories: Category[]) => {
    setBusyId(account.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verified
          ? { action: 'set_verification', verified: true, categories }
          : { action: 'set_verification', verified: false }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Verification update failed')
      }
      setVerifyTarget(null)
      setVerifyCategories([])
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update verification.')
    } finally {
      setBusyId(null)
    }
  }, [load])

  const deleteAccounts = useCallback(async (targets: AdminAccountRow[]) => {
    if (targets.length === 0) return
    setError(null)
    setBusyId('bulk')

    const failures: string[] = []
    for (const account of targets) {
      setBusyId(account.id)
      try {
        const res = await fetch(`/api/admin/users/${account.id}`, { method: 'DELETE' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          failures.push(`${account.email}: ${body.error ?? 'Delete failed'}`)
        }
      } catch {
        failures.push(`${account.email}: Network error`)
      }
    }

    setDeleteTarget(null)
    setBulkDeleteTargets([])
    setBusyId(null)
    await load()

    if (failures.length > 0) {
      setError(failures.join(' · '))
    }
  }, [load])

  const createAccount = useCallback(async () => {
    setBusyId('add')
    setAddError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: addName.trim(),
          email: addEmail.trim(),
          role: addRole,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Failed to create account')
      }
      setAddOpen(false)
      setAddName('')
      setAddEmail('')
      setAddRole('hirer')
      await load()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create account.')
    } finally {
      setBusyId(null)
    }
  }, [addName, addEmail, addRole, load])

  const columns = useAdminAccountColumns({
    busyId,
    onRoleChange: (id, role) => { void changeRole(id, role) },
    onSuspendRequest: account => {
      setSuspendTarget(account)
      setSuspendReason('')
    },
    onRestore: account => { void restoreAccount(account) },
    onDeleteRequest: account => setDeleteTarget(account),
    onVerifyRequest: account => {
      setVerifyTarget(account)
      setVerifyCategories([])
    },
    onUnverify: account => { void setVerification(account, false, []) },
    onTierChange: (account, tier) => { void setMembershipTier(account, tier) },
  })

  const toolbar = (
    <>
      <Input
        className="flex-1 lg:max-w-sm"
        placeholder="Search by name or email"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <Select value={filter} onValueChange={value => setFilter(value as AccountFilter)} items={ACCOUNT_FILTERS}>
        <SelectTrigger aria-label="Filter accounts" className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ACCOUNT_FILTERS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={() => {
          setAddError(null)
          setAddOpen(true)
        }}
      >
        Add account
      </Button>
    </>
  )

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <DataTable
        columns={columns}
        data={accounts}
        toolbar={toolbar}
        emptyMessage={loading ? 'Loading accounts…' : 'No accounts match your filters.'}
        bulkActions={selected => {
          const deletable = selected.filter(a => a.display_role !== 'admin')
          if (deletable.length === 0) return null
          return (
            <Button
              size="sm"
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => setBulkDeleteTargets(deletable)}
            >
              Delete selected ({deletable.length})
            </Button>
          )
        }}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add account</DialogTitle>
            <DialogDescription>
              Create a new account on the platform. The user signs in with this email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Full name"
              value={addName}
              onChange={e => setAddName(e.target.value)}
            />
            <Input
              type="email"
              placeholder="Email address"
              value={addEmail}
              onChange={e => setAddEmail(e.target.value)}
            />
            <Select value={addRole} onValueChange={value => setAddRole(value as AccountRole)} items={ROLE_OPTIONS}>
              <SelectTrigger aria-label="Account role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {addError ? <p className="text-sm text-destructive">{addError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={!addName.trim() || !addEmail.trim().includes('@') || busyId !== null}
              onClick={() => void createAccount()}
            >
              Create account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={verifyTarget !== null} onOpenChange={open => { if (!open) setVerifyTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify talent</DialogTitle>
            <DialogDescription>
              {verifyTarget ? `Grant ${verifyTarget.full_name} the Atlas Verified badge. Pick the categories they are verified for.` : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {(Object.entries(CATEGORY_LABELS) as Array<[Category, string]>).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={verifyCategories.includes(value)}
                  onCheckedChange={checked => {
                    setVerifyCategories(current => checked
                      ? [...current, value]
                      : current.filter(category => category !== value))
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyTarget(null)}>Cancel</Button>
            <Button
              disabled={verifyCategories.length === 0 || busyId !== null}
              onClick={() => verifyTarget && void setVerification(verifyTarget, true, verifyCategories)}
            >
              Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suspendTarget !== null} onOpenChange={open => { if (!open) setSuspendTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend account</DialogTitle>
            <DialogDescription>
              {suspendTarget ? `Suspend ${suspendTarget.full_name} (${suspendTarget.email})?` : null}
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Suspension reason (required)"
            value={suspendReason}
            onChange={e => setSuspendReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!suspendReason.trim() || busyId !== null}
              onClick={() => suspendTarget && void suspendAccount(suspendTarget, suspendReason.trim())}
            >
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Permanently delete ${deleteTarget.full_name} (${deleteTarget.email})? This removes their profile, jobs, messages, and uploads. This cannot be undone.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => deleteTarget && void deleteAccounts([deleteTarget])}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteTargets.length > 0} onOpenChange={open => { if (!open) setBulkDeleteTargets([]) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {bulkDeleteTargets.length} accounts</DialogTitle>
            <DialogDescription>
              Permanently delete the selected accounts? Platform admins in the selection are excluded. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteTargets([])}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => void deleteAccounts(bulkDeleteTargets)}
            >
              Delete {bulkDeleteTargets.length} accounts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
