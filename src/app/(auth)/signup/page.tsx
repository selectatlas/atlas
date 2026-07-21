'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearLocalDemoCookies } from '@/lib/demo-mode'
import { safeInternalPath } from '@/lib/safe-redirect'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import type { AccountType } from '@/types'

export default function SignupPage() {
  // useSearchParams requires a Suspense boundary during static rendering.
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // A brief typed into the landing-page hero arrives as ?q= so a new hirer
  // lands directly on their first search after signing up.
  const heroQuery = searchParams.get('q')?.trim() ?? ''
  // Where to land after signup; set by "Sign in to apply" CTAs on public job
  // pages. Validated before use. Talent onboarding still takes precedence.
  const nextPath = searchParams.get('next')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // ?as= preselects the account type so a "Sign up to apply" CTA does not
  // greet talent with "I'm Hiring" highlighted. Still freely changeable.
  const [accountType, setAccountType] = useState<AccountType>(
    searchParams.get('as') === 'talent' ? 'talent' : 'hirer'
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, account_type: accountType },
          // Confirmation emails must land back on the callback so the session
          // is established and the user reaches the dashboard, not the landing page.
          emailRedirectTo: nextPath
            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
            : `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.user) {
        clearLocalDemoCookies()
        posthog.identify(data.user.id, {
          account_type: accountType,
        })
        posthog.capture('user_signed_up', {
          account_type: accountType,
          requires_email_confirmation: !data.session,
        })
      }

      if (!data.session) {
        setCheckEmail(true)
        return
      }

      // Fresh talent accounts go straight into profile onboarding - the
      // original destination rides along as ?next= so finishing (or skipping)
      // the wizard resumes the task they signed up for. Hirers who arrived
      // with a brief from the landing page land on that search; otherwise a
      // validated ?next= target (public job CTAs) wins over /home.
      if (accountType === 'talent') {
        router.push(
          nextPath
            ? `/onboarding?next=${encodeURIComponent(safeInternalPath(nextPath))}`
            : '/onboarding'
        )
      } else if (heroQuery) {
        router.push(`/search?q=${encodeURIComponent(heroQuery)}`)
      } else {
        router.push(safeInternalPath(nextPath))
      }
      router.refresh()
    } catch {
      setError('Unable to reach the sign-up service. Please try again.')
    } finally {
      setLoading(false)
    }
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
            <Link
              href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}
              className="text-primary hover:text-primary/80"
            >
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
          <h1 className="text-2xl font-bold tracking-tight">Atlas</h1>
          <p className="mt-2 text-muted-foreground text-sm">AI-native talent discovery</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
          </CardHeader>
          <CardContent>
            {heroQuery && accountType === 'hirer' && (
              <p className="mb-6 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                We&apos;ll run your search as soon as you&apos;re in:{' '}
                <span className="text-foreground font-medium">&ldquo;{heroQuery}&rdquo;</span>
              </p>
            )}
            {/* Account type selector */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAccountType('hirer')}
                aria-pressed={accountType === 'hirer'}
                className={`h-auto flex-col items-start rounded-xl border-2 p-4 text-left ${
                  accountType === 'hirer' ? 'border-primary bg-primary/5' : 'border-border bg-muted/50'
                }`}
              >
                <div className="text-2xl mb-2">🎬</div>
                <div className="text-sm font-semibold">I&apos;m Hiring</div>
                <div className="text-xs font-normal text-muted-foreground mt-0.5">Cast directors, producers</div>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAccountType('talent')}
                aria-pressed={accountType === 'talent'}
                className={`h-auto flex-col items-start rounded-xl border-2 p-4 text-left ${
                  accountType === 'talent' ? 'border-primary bg-primary/5' : 'border-border bg-muted/50'
                }`}
              >
                <div className="text-2xl mb-2">⭐</div>
                <div className="text-sm font-semibold">I&apos;m Talent</div>
                <div className="text-xs font-normal text-muted-foreground mt-0.5">Dancers, actors, creators</div>
              </Button>
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

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <GoogleSignInButton accountType={accountType} next={nextPath} onError={setError} />
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'} className="text-primary hover:text-primary/80 font-medium">
            Sign in
          </Link>
        </p>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 transition-colors hover:text-foreground">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline underline-offset-2 transition-colors hover:text-foreground">
            Privacy Policy
          </Link>.
        </p>
      </div>
    </div>
  )
}
