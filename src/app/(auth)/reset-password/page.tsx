'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => {
        supabase.auth.signOut().then(() => {
          router.push('/login')
          router.refresh()
        })
      }, 2500)
    }
    setLoading(false)
  }

  if (hasSession === null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle>Link expired or invalid</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl mb-4">⏰</div>
              <p className="text-muted-foreground text-sm mb-6">
                This reset link has expired or is invalid. Reset links expire after 1 hour.
              </p>
              <Link href="/forgot-password">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/80 h-11 rounded-xl font-semibold">
                  Request a new link
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">castd.ai</h1>
        </div>

        <Card>
          {success ? (
            <>
              <CardHeader>
                <CardTitle>Password updated</CardTitle>
              </CardHeader>
              <CardContent className="text-center py-4">
                <div className="text-4xl mb-4">✅</div>
                <p className="text-muted-foreground text-sm">
                  Redirecting to sign in...
                </p>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Set new password</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-sm font-medium">
                      New password
                    </label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      minLength={8}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirm" className="text-sm font-medium">
                      Confirm new password
                    </label>
                    <Input
                      id="confirm"
                      type="password"
                      required
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Re-enter your password"
                      minLength={8}
                    />
                  </div>

                  {error && (
                    <p className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/80 h-11 rounded-xl font-semibold"
                  >
                    {loading ? 'Updating...' : 'Set new password'}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
