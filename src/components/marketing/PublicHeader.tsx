import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Signed-out chrome for public marketplace pages. Deliberately standalone
// (Tailwind, no session providers): AppTopBar assumes the authed shell, and
// the landing header's paper aesthetic stays scoped to the landing page.
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-base font-bold tracking-tight" aria-label="Atlas home">
          atlas<span className="text-muted-foreground">.select</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/login" />} variant="ghost" className="rounded-xl text-sm font-medium">
            Sign in
          </Button>
          <Button
            render={<Link href="/signup" />}
            className="rounded-xl bg-accent text-sm font-semibold text-accent-foreground hover:bg-accent/80"
          >
            Sign up
          </Button>
        </div>
      </div>
    </header>
  )
}
