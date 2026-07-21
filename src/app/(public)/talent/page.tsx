import type { Metadata } from 'next'
import { createAnonClient } from '@/lib/supabase/server'
import { fetchPublicTalent } from '@/lib/talent-discovery'
import { PublicTalentExplorer } from '@/components/talent/PublicTalentExplorer'

// ISR: rendered without cookies or searchParams so the page stays static,
// revalidating every 5 minutes. Crawlers get real talent cards as HTML; the
// explorer island handles filters and pagination client-side. Mirrors the
// public /jobs marketplace.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Find creative talent - dancers, actors, creators',
  description:
    'Browse dancers, actors, and content creators available for hire. See skills, rates, and availability - create a free account to view full profiles and get in touch.',
  alternates: { canonical: '/talent' },
  openGraph: {
    title: 'Find creative talent on Atlas',
    description:
      'Browse dancers, actors, and content creators available for hire. See skills, rates, and availability.',
    url: '/talent',
  },
}

export default async function PublicTalentPage() {
  const feed = await fetchPublicTalent(createAnonClient(), { category: null, search: '' }, null)

  // At runtime, throwing on failure keeps ISR serving the last good page
  // instead of caching an empty render for 5 minutes. Build machines (CI)
  // run with a placeholder Supabase URL, so the build phase renders the
  // empty shell instead - the first successful revalidation fills it.
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
  if (!feed.ok && !isBuildPhase) throw new Error('Talent feed unavailable')

  const initialPage = feed.ok ? feed.page : { talent: [], nextCursor: null, total: null }

  return (
    <div className="space-y-6 pb-16">
      <header className="space-y-2 pt-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Creative talent, ready to book</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Dancers, actors, and content creators with real skills, rates, and availability. Browse freely - create a
          free account to view full profiles and get in touch.
        </p>
      </header>

      <PublicTalentExplorer initialPage={initialPage} />
    </div>
  )
}
