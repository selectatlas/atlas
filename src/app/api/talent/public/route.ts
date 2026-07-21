import { NextResponse, type NextRequest } from 'next/server'
import { createAnonClient } from '@/lib/supabase/server'
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit'
import { fetchPublicTalent, parsePublicTalentParams } from '@/lib/talent-discovery'

// GET /api/talent/public - anonymous marketplace feed for the public /talent
// explorer. Intentionally unauthenticated: the public_talent_profiles view
// (migration 031) is the security boundary, so this route can only ever see
// the reduced projection of public, onboarded, non-suspended talent. Full
// profiles stay behind auth. Rate limited per IP.
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(`talent-public:${getClientIp(request)}`, 60, 60)
  if (limited) return limited

  const parsed = parsePublicTalentParams(request.nextUrl.searchParams)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const result = await fetchPublicTalent(createAnonClient(), parsed.filters, parsed.cursor)
  if (!result.ok) {
    return NextResponse.json({ error: 'Talent could not be loaded' }, { status: 500 })
  }

  return NextResponse.json(result.page, {
    // Cheap CDN shielding: identical anonymous filter queries share a cached
    // response for a minute instead of each hitting Postgres.
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}
