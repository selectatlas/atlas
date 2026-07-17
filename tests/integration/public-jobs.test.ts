import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  API_URL,
  ANON_KEY,
  adminClient,
  createTestUser,
  deleteTestUsers,
  isStackRunning,
  type TestUser,
} from './helpers'

// Public job browsing (migration 026) against the real local stack: anonymous
// clients see only the open marketplace, profiles stay closed, and the
// public_open_jobs view is the one window onto hirer display fields.

const stackUp = await isStackRunning()

if (process.env.CI === 'true' && !stackUp) {
  throw new Error('Supabase stack is required in CI but is not running or credentialed')
}

describe.skipIf(!stackUp)('Public job browsing (real database)', () => {
  let admin: SupabaseClient
  let anon: SupabaseClient
  let hirer: TestUser
  let openJobId: string
  let closedJobId: string
  let removedJobId: string

  beforeAll(async () => {
    admin = adminClient()
    anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } })
    hirer = await createTestUser(admin, 'hirer', 'pubjobs-hirer')

    const { data, error } = await admin
      .from('jobs')
      .insert([
        {
          hirer_id: hirer.id,
          title: 'Public open role',
          description: 'Visible to everyone',
          category: 'dancer',
          location: 'London',
          status: 'open',
        },
        {
          hirer_id: hirer.id,
          title: 'Closed role',
          description: 'Hirer-only history',
          category: 'actor',
          location: 'Leeds',
          status: 'closed',
        },
        {
          hirer_id: hirer.id,
          title: 'Removed role',
          description: 'Moderation takedown',
          category: 'dancer',
          location: 'Bristol',
          status: 'open',
          removed_at: new Date().toISOString(),
        },
      ])
      .select('id, title')
    expect(error).toBeNull()
    openJobId = data!.find(job => job.title === 'Public open role')!.id
    closedJobId = data!.find(job => job.title === 'Closed role')!.id
    removedJobId = data!.find(job => job.title === 'Removed role')!.id
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('jobs').delete().in('id', [openJobId, closedJobId, removedJobId].filter(Boolean))
    await deleteTestUsers(admin, [hirer].filter(Boolean))
  })

  it('anonymous clients can read open jobs', async () => {
    const { data, error } = await anon.from('jobs').select('id, title').eq('id', openJobId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('anonymous clients cannot see closed or removed jobs', async () => {
    const { data: closed } = await anon.from('jobs').select('id').eq('id', closedJobId)
    expect(closed ?? []).toHaveLength(0)

    const { data: removed } = await anon.from('jobs').select('id').eq('id', removedJobId)
    expect(removed ?? []).toHaveLength(0)
  })

  it('anonymous clients still cannot read profiles', async () => {
    const { error } = await anon.from('profiles').select('id, full_name').eq('id', hirer.id)
    expect(error).not.toBeNull()
  })

  it('the public view exposes the hirer display name for open jobs only', async () => {
    const { data, error } = await anon
      .from('public_open_jobs')
      .select('id, title, hirer_name')
      .eq('id', openJobId)
      .single()
    expect(error).toBeNull()
    expect(data?.hirer_name).toBe('Test pubjobs-hirer')

    const { data: hidden } = await anon
      .from('public_open_jobs')
      .select('id')
      .in('id', [closedJobId, removedJobId])
    expect(hidden ?? []).toHaveLength(0)
  })

  it('the public view never exposes moderation or embedding internals', async () => {
    const { data } = await anon.from('public_open_jobs').select('*').eq('id', openJobId).single()
    expect(data).not.toHaveProperty('removed_at')
    expect(data).not.toHaveProperty('removal_reason')
    expect(data).not.toHaveProperty('embedding_status')
    expect(data).not.toHaveProperty('embedding_error')
  })

  it('anon cannot read embedding internals off the jobs table directly', async () => {
    const { error } = await anon.from('jobs').select('embedding_status, embedding_error').eq('id', openJobId)
    expect(error).not.toBeNull()
  })

  it('anonymous clients can call the facet RPCs', async () => {
    const { data: locations, error: locationsError } = await anon.rpc('open_job_locations')
    expect(locationsError).toBeNull()
    expect(locations).toContain('London')

    const { data: counts, error: countsError } = await anon.rpc('open_job_category_counts')
    expect(countsError).toBeNull()
    const dancer = ((counts ?? []) as Array<{ category: string; job_count: number }>).find(
      row => row.category === 'dancer'
    )
    expect(Number(dancer?.job_count ?? 0)).toBeGreaterThanOrEqual(1)
  })

  it('the authenticated hirer still sees their closed job (regression guard)', async () => {
    const { data, error } = await hirer.client.from('jobs').select('id').eq('id', closedJobId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })
})

// Always-on guard so the file fails loudly if someone points it at production.
describe('public jobs integration environment guard', () => {
  it('refuses to run against non-local Supabase URLs', () => {
    expect(API_URL.includes('127.0.0.1') || API_URL.includes('localhost') || !stackUp).toBe(true)
  })
})
