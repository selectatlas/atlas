'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearLocalDemoCookies } from '@/lib/demo-mode'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { LegalFooterLinks } from '@/components/layout/LegalFooterLinks'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const reason = new URLSearchParams(window.location.search).get('error')
    if (reason === 'oauth') return 'Google sign-in failed. Please try again.'
    if (reason === 'confirm') return 'That confirmation link is invalid or has expired. Sign in below, or sign up again to receive a new link.'
    return null
  })
  const [loading, setLoading] = useState(false)
  const demoLoginEnabled = process.env.NODE_ENV === 'development'

  async function signIn(emailValue: string, passwordValue: string) {
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailValue,
        password: passwordValue,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      clearLocalDemoCookies()
      const accountType = data.user?.user_metadata?.account_type
      posthog.identify(data.user!.id, {
        account_type: accountType,
      })
      posthog.capture('user_signed_in', {
        account_type: accountType,
      })
      router.push('/home')
      router.refresh()
    } catch {
      setError('Unable to reach the sign-in service. Check your Supabase configuration and try again.')
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await signIn(email, password)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Atlas</h1>
          <p className="mt-2 text-muted-foreground text-sm">AI-native talent discovery</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <div className="text-right">
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/80 h-11 rounded-xl font-semibold"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <GoogleSignInButton onError={setError} />

            {demoLoginEnabled && (
              <div className="mt-5 border-t border-border/70 pt-5">
                <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preview the product</p>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="/api/demo-login?role=hirer"
                    className="flex h-9 items-center justify-center rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground transition-[transform,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-primary/90 active:scale-[0.97]"
                  >
                    Hirer workspace
                  </a>
                  <a
                    href="/api/demo-login?role=talent"
                    className="flex h-9 items-center justify-center rounded-lg border border-border bg-background px-2 text-xs font-medium transition-[transform,background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-muted hover:text-foreground active:scale-[0.97]"
                  >
                    Talent workspace
                  </a>
                </div>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Development-only demo access
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link href="/signup" className="text-primary hover:text-primary/80 font-medium">
            Sign up
          </Link>
        </p>

        <LegalFooterLinks className="mt-6" />
      </div>
    </div>
  )
}
