'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { createClient } from '@/lib/supabase/client'

function identifyUser(user: { id: string; user_metadata?: Record<string, unknown> }) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return
  posthog.identify(user.id, {
    account_type: user.user_metadata?.account_type,
  })
}

export function PostHogAuthSync() {
  useEffect(() => {
    const supabase = createClient()

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) identifyUser(user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        identifyUser(session.user)
        return
      }
      if (event === 'SIGNED_OUT') posthog.reset()
    })

    return () => subscription.unsubscribe()
  }, [])

  return null
}
