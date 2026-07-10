'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AccountType } from '@/types'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('hirer')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, account_type: accountType },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setCheckEmail(true)
      setLoading(false)
      return
    }

    router.push(accountType === 'hirer' ? '/search' : '/discover')
    router.refresh()
  }

  if (checkEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-xl font-semibold mb-2">Check your email</h2>
          <p className="text-muted-foreground text-sm">
            We sent a confirmation link to <span className="text-foreground font-medium">{email}</span>.
            Click it to activate your account, then{' '}
            <Link href="/login" className="text-primary hover:text-primary/80">
              sign in
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">castd.ai</h1>
          <p className="mt-2 text-muted-foreground text-sm">AI-native talent discovery</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Account type selector */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => setAccountType('hirer')}
                className={`rounded-xl border-2 p-4 text-left transition-[border-color,background-color,box-shadow] duration-[var(--duration-fast)] ${
                  accountType === 'hirer'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/50 hover:border-muted-foreground/30'
                }`}
              >
                <div className="text-2xl mb-2">🎬</div>
                <div className="text-sm font-semibold">I&apos;m Hiring</div>
                <div className="text-xs text-muted-foreground mt-0.5">Cast directors, producers</div>
              </button>
              <button
                type="button"
                onClick={() => setAccountType('talent')}
                className={`rounded-xl border-2 p-4 text-left transition-[border-color,background-color,box-shadow] duration-[var(--duration-fast)] ${
                  accountType === 'talent'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/50 hover:border-muted-foreground/30'
                }`}
              >
                <div className="text-2xl mb-2">⭐</div>
                <div className="text-sm font-semibold">I&apos;m Talent</div>
                <div className="text-xs text-muted-foreground mt-0.5">Dancers, actors, creators</div>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="text-sm font-medium">
                  Full name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:text-primary/80 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
