import { NextResponse, type NextRequest } from 'next/server'
import { createAnonClient } from '@/lib/supabase/server'
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit'
import { fetchDiscoverJobs, parseDiscoverParams } from '@/lib/job-discovery'

// GET /api/jobs/public - anonymous marketplace feed for the public /jobs
// explorer. Intentionally unauthenticated: row scoping is enforced by the
// anon RLS policy and the public_open_jobs view (migration 026), so this
// route can only ever see open, non-removed jobs. Rate limited per IP.
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(`jobs-public:${getClientIp(request)}`, 60, 60)
  if (limited) return limited

  const parsed = parseDiscoverParams(request.nextUrl.searchParams)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const result = await fetchDiscoverJobs(createAnonClient(), parsed.filters, {
    cursor: parsed.cursor,
    countOnly: parsed.countOnly,
    source: 'public',
  })
  if (!result.ok) {
    return NextResponse.json({ error: 'Jobs could not be loaded' }, { status: 500 })
  }

  return NextResponse.json(result.page, {
    // Cheap CDN shielding: identical anonymous filter queries share a cached
    // response for a minute instead of each hitting Postgres.
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}
