// GET /api/health — non-sensitive service health for uptime checks.
// Publicly reachable (exempted in src/proxy.ts). Exposes no secrets, no
// versions, no internal hostnames - only coarse component status.

export async function GET() {
  let database: 'ok' | 'unreachable' = 'unreachable'

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })
    if (response.ok) database = 'ok'
  } catch {
    // reported as unreachable
  }

  const healthy = database === 'ok'
  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
