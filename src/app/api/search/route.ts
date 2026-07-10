import { createServiceClient } from '@/lib/supabase/server'
import { embedText, parseSearchQuery } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { query } = await request.json() as { query: string }

  if (!query?.trim()) {
    return Response.json({ error: 'query required' }, { status: 400 })
  }

  // Verify the caller is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Run LLM parse and embedding IN PARALLEL to stay under the 2s SLA
  const [parsed, queryEmbedding] = await Promise.all([
    parseSearchQuery(query),
    embedText(query),
  ])

  // Build the pgvector similarity query via Supabase RPC
  // The function `match_talent` is defined below - call it via rpc
  const serviceClient = createServiceClient()

  // Use raw SQL via Supabase rpc for cosine similarity search
  // match_count=20 so we have room to filter, return top 12 after filtering
  const { data: matches, error } = await serviceClient.rpc('match_talent', {
    query_embedding: queryEmbedding,
    match_count: 20,
  })

  if (error) {
    console.error('pgvector search error:', error)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }

  // Fetch full profiles + skills for the matched IDs
  const profileIds = (matches as Array<{ profile_id: string; similarity: number }>).map(m => m.profile_id)
  const similarityMap = new Map(
    (matches as Array<{ profile_id: string; similarity: number }>).map(m => [m.profile_id, m.similarity])
  )

  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('*, talent_skills(*)')
    .in('id', profileIds)
    .eq('account_type', 'talent')

  if (!profiles) return Response.json({ results: [] })

  // Apply structured filters from LLM parse on top of vector results
  let filtered = profiles as Array<Record<string, unknown> & { talent_skills: Array<{ category: string; skill: string }> }>

  if (parsed.category) {
    filtered = filtered.filter(p =>
      p.talent_skills.some((s) => s.category === parsed.category)
    )
  }

  if (parsed.location) {
    const loc = parsed.location.toLowerCase()
    filtered = filtered.filter(p =>
      (p.city as string | null)?.toLowerCase().includes(loc) ||
      (p.country as string | null)?.toLowerCase().includes(loc)
    )
  }

  // Sort by similarity and attach match score
  // Cosine similarity for text-embedding-3-small is typically 0.3-0.85 for relevant matches.
  // Scale to 55-98% so scores feel meaningful without being misleadingly high.
  const results = filtered
    .map(p => {
      const sim = similarityMap.get(p.id as string) ?? 0
      const score = Math.min(98, Math.max(55, Math.round(sim * 120)))
      return { profile: p, match_score: score }
    })
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 12)

  return Response.json({ results, parsed })
}
