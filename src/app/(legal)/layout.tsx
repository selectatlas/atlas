import Link from 'next/link'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            atlas<b className="text-primary">.ai</b>
          </Link>
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/login" className="transition-colors hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>

      <footer className="border-t border-border/80">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <p>© 2026 Atlas</p>
          <div className="flex gap-4">
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms of Service</Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
