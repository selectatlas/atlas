import { LegalFooterLinks } from '@/components/layout/LegalFooterLinks'
import { PublicHeader } from '@/components/marketing/PublicHeader'

// Public route group: no session, no auth redirect, no app-shell providers.
// Anonymous visitors browse here; the proxy routes signed-in talent to the
// authed equivalents (/discover) before these pages render.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border/60 py-6">
        <LegalFooterLinks />
      </footer>
    </div>
  )
}
