'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

type Viewer = 'anon' | 'talent' | 'hirer'

// The public job detail page is static (ISR), so it cannot know the viewer.
// It renders the anonymous CTA; after hydration a session check swaps it.
// (Signed-in talent are normally proxy-redirected to /discover/{id} before
// reaching this page - the talent branch is a safety net, and hirers just
// should not see a sign-up button.)
export function AuthAwareApplyCta({ jobId }: { jobId: string }) {
  const [viewer, setViewer] = useState<Viewer>('anon')

  useEffect(() => {
    let cancelled = false
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (cancelled) return
        const type = data.session?.user.user_metadata?.account_type
        if (type === 'talent') setViewer('talent')
        else if (type === 'hirer') setViewer('hirer')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (viewer === 'hirer') return null

  if (viewer === 'talent') {
    return (
      <Button
        render={<Link href={`/discover/${jobId}?intent=apply`} />}
        className="w-full rounded-xl bg-accent font-semibold text-accent-foreground hover:bg-accent/80"
      >
        Open in Discover to apply
      </Button>
    )
  }

  // The intent rides inside next so it survives signup, email confirmation,
  // OAuth, and onboarding; the discover page consumes it by opening the apply
  // flow. as=talent preselects the right account type on the signup page.
  // next stays the first param - e2e asserts on the /signup?next= prefix.
  const next = encodeURIComponent(`/jobs/${jobId}?intent=apply`)
  return (
    <div className="space-y-2">
      <Button
        render={<Link href={`/signup?next=${next}&as=talent`} />}
        className="w-full rounded-xl bg-accent font-semibold text-accent-foreground hover:bg-accent/80"
      >
        Sign up to apply
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{' '}
        <Link href={`/login?next=${next}`} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
