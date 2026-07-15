'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AdminAddTalentPanel() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/talent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          city: city || null,
          country: country || null,
        }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string; talent?: { full_name: string; email: string } }
      if (!res.ok) throw new Error(body.error ?? 'Failed to create talent')

      setSuccess(`${body.talent?.full_name ?? 'Talent'} added. They can sign in with ${body.talent?.email ?? email} via forgot password.`)
      setFullName('')
      setEmail('')
      setCity('')
      setCountry('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create talent')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Create talent account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="talent-name">Full name</label>
            <input
              id="talent-name"
              required
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="talent-email">Email</label>
            <input
              id="talent-email"
              type="email"
              required
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="talent-city">City</label>
              <input
                id="talent-city"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="talent-country">Country</label>
              <input
                id="talent-country"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={country}
                onChange={e => setCountry(e.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-muted-foreground">{success}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Add talent'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
