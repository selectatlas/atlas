import { createServiceClient } from '@/lib/supabase/server'
import { logEvent } from '@/lib/log'

// Postgres-backed fixed-window rate limiting (see migration 007). Counters
// live in the database so limits hold across serverless instances.

interface LimitOptions {
  // When the limiter itself fails: fail open for cheap endpoints (availability),
  // fail closed for anything that spends money (AI calls).
  failClosed?: boolean
}

interface LimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export const AI_DAILY_QUOTA = 200

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export async function consumeLimit(
  key: string,
  windowSeconds: number,
  max: number,
  options: LimitOptions = {},
): Promise<LimitResult> {
  try {
    const service = createServiceClient()
    const { data, error } = await service.rpc('consume_rate_limit', {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: max,
    })

    if (error) throw error

    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; retry_after_seconds: number }
      | undefined
    if (!row) throw new Error('empty rate limit result')

    return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds }
  } catch (err) {
    logEvent('error', 'rate_limit_store_error', {
      key_prefix: key.split(':')[0],
      fail_closed: Boolean(options.failClosed),
      message: err instanceof Error ? err.message : 'unknown',
    })
    return { allowed: !options.failClosed, retryAfterSeconds: 60 }
  }
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { error: 'Too many requests. Please retry later.', retry_after_seconds: retryAfterSeconds },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  )
}

// Convenience: returns a 429 Response when over the limit, otherwise null.
export async function enforceRateLimit(
  key: string,
  windowSeconds: number,
  max: number,
  options: LimitOptions = {},
): Promise<Response | null> {
  const result = await consumeLimit(key, windowSeconds, max, options)
  if (result.allowed) return null
  logEvent('warn', 'rate_limit_exceeded', { key_prefix: key.split(':')[0] })
  return tooManyRequests(result.retryAfterSeconds)
}

// Daily per-user AI spend quota. Fails closed: if the quota store is down we
// refuse to spend OpenAI credits rather than allowing unmetered usage.
export async function enforceAiQuota(userId: string): Promise<Response | null> {
  const result = await consumeLimit(`ai-daily:${userId}`, 86_400, AI_DAILY_QUOTA, {
    failClosed: true,
  })
  if (result.allowed) return null
  logEvent('warn', 'ai_quota_exceeded', { user_id: userId })
  return tooManyRequests(result.retryAfterSeconds)
}
