'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { AccountType } from '@/types'

interface GoogleSignInButtonProps {
  // Set on the signup page so the OAuth callback knows which workspace the
  // user picked; omit on login (returning users already have a type).
  accountType?: AccountType
  onError: (message: string) => void
}

export function GoogleSignInButton({ accountType, onError }: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const supabase = createClient()
      const redirectTo = new URL('/auth/callback', window.location.origin)
      if (accountType) redirectTo.searchParams.set('account_type', accountType)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo.toString() },
      })

      if (error) {
        onError(error.message)
        setLoading(false)
      }
      // On success the browser navigates to Google; keep the loading state.
    } catch {
      onError('Unable to reach the sign-in service. Check your Supabase configuration and try again.')
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className="w-full h-11 rounded-xl font-semibold"
    >
      <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.59-5.17 3.59-8.8Z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.28 14.28a7.21 7.21 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
      </svg>
      {loading ? 'Redirecting to Google...' : 'Continue with Google'}
    </Button>
  )
}
