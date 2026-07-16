import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ get: vi.fn() }) }))
vi.mock('@/lib/openai', () => ({
  generateMessageAssist: vi.fn().mockResolvedValue('Suggested reply text.'),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { generateMessageAssist } from '@/lib/openai'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockGenerate = generateMessageAssist as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>
const mockEnforceAiQuota = enforceAiQuota as ReturnType<typeof vi.fn>

const THREAD_ID = '11111111-1111-4111-8111-111111111111'

function makeClient({
  user,
  isParticipant,
}: {
  user: { id: string } | null
  isParticipant?: boolean
}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'thread_participants') {
        return {
          select: (fields: string) => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: isParticipant ? { profile_id: user?.id } : null }),
              }),
              neq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: fields.includes('profiles') ? { profiles: { full_name: 'Asha Rao' } } : null,
                  }),
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: { account_type: 'hirer' } }) }),
          }),
        }
      }
      if (table === 'message_threads') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: { jobs: { title: 'Music video' } } }) }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: [{ content: 'Hello!', sender_id: 'other', created_at: '2026-01-01T10:00:00Z' }],
                }),
            }),
          }),
        }),
      }
    }),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/messages/assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/messages/assist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
    mockEnforceAiQuota.mockResolvedValue(null)
    mockGenerate.mockResolvedValue('Suggested reply text.')
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }))
    const res = await POST(makeRequest({ thread_id: THREAD_ID, mode: 'draft' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-participant without calling OpenAI', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: false }))
    const res = await POST(makeRequest({ thread_id: THREAD_ID, mode: 'draft' }))
    expect(res.status).toBe(403)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('rejects an invalid mode or thread id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: true }))
    expect((await POST(makeRequest({ thread_id: THREAD_ID, mode: 'shakespearean' }))).status).toBe(400)
    expect((await POST(makeRequest({ thread_id: 'nope', mode: 'draft' }))).status).toBe(400)
  })

  it('requires a draft for rewrite modes', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: true }))
    const res = await POST(makeRequest({ thread_id: THREAD_ID, mode: 'friendlier' }))
    expect(res.status).toBe(400)
  })

  it('returns 429 before any OpenAI spend when the AI quota is exhausted', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: true }))
    mockEnforceAiQuota.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ thread_id: THREAD_ID, mode: 'draft' }))
    expect(res.status).toBe(429)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('returns a suggestion for a participant', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: true }))
    const res = await POST(makeRequest({ thread_id: THREAD_ID, mode: 'draft' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.message).toBe('Suggested reply text.')
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'draft',
        senderRole: 'hirer',
        otherName: 'Asha Rao',
        jobTitle: 'Music video',
      }),
    )
  })

  it('rewrites a draft', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: true }))
    const res = await POST(makeRequest({ thread_id: THREAD_ID, mode: 'concise', draft: 'A very long draft message.' }))
    expect(res.status).toBe(200)
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'concise', draft: 'A very long draft message.' }),
    )
  })

  it('returns 503 (not a crash) when OpenAI fails', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: true }))
    mockGenerate.mockRejectedValue(new Error('upstream timeout'))
    const res = await POST(makeRequest({ thread_id: THREAD_ID, mode: 'draft' }))
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toBe('Writing assistance is temporarily unavailable')
  })
})
