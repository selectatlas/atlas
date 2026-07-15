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

// Real two-role RLS verification against a local Supabase stack. These tests
// exercise the actual policies, column grants, and RPCs - no mocks. The suite
// skips itself when the stack is not running (start it with `supabase start`).

const stackUp = await isStackRunning()

if (process.env.CI === 'true' && !stackUp) {
  throw new Error('Supabase stack is required in CI but is not running or credentialed')
}

describe.skipIf(!stackUp)('Row-level security (real database)', () => {
  let admin: SupabaseClient
  let anon: SupabaseClient
  let hirer: TestUser
  let hirer2: TestUser
  let talent: TestUser
  let talent2: TestUser
  let threadId: string
  let jobId: string

  beforeAll(async () => {
    admin = adminClient()
    anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } })
    ;[hirer, hirer2, talent, talent2] = await Promise.all([
      createTestUser(admin, 'hirer', 'hirer1'),
      createTestUser(admin, 'hirer', 'hirer2'),
      createTestUser(admin, 'talent', 'talent1'),
      createTestUser(admin, 'talent', 'talent2'),
    ])
  })

  afterAll(async () => {
    if (admin) await deleteTestUsers(admin, [hirer, hirer2, talent, talent2].filter(Boolean))
  })

  describe('profiles privacy', () => {
    it('signup trigger created a profile with the requested role', async () => {
      const { data } = await admin.from('profiles').select('account_type').eq('id', talent.id).single()
      expect(data?.account_type).toBe('talent')
    })

    it('anonymous clients cannot read profiles at all', async () => {
      const { error } = await anon.from('profiles').select('id, full_name')
      expect(error).not.toBeNull()
    })

    it('authenticated users cannot select email from another profile', async () => {
      const { error } = await talent.client
        .from('profiles')
        .select('email')
        .eq('id', hirer.id)
      expect(error).not.toBeNull()
    })

    it('select * on profiles is rejected (column grants, not row filters)', async () => {
      const { error } = await talent.client.from('profiles').select('*').eq('id', hirer.id)
      expect(error).not.toBeNull()
    })

    it('authenticated users can read the public field list', async () => {
      const { data, error } = await talent.client
        .from('profiles')
        .select('id, full_name, account_type')
        .eq('id', hirer.id)
        .single()
      expect(error).toBeNull()
      expect(data?.full_name).toBe('Test hirer1')
      expect(data).not.toHaveProperty('email')
    })

    it('users cannot change their own account_type or email', async () => {
      const { error } = await talent.client
        .from('profiles')
        .update({ account_type: 'hirer' })
        .eq('id', talent.id)
      expect(error).not.toBeNull()
    })

    it('users cannot update another profile', async () => {
      const { data } = await talent.client
        .from('profiles')
        .update({ headline: 'hacked' })
        .eq('id', talent2.id)
        .select('id')
      expect(data ?? []).toHaveLength(0)
    })

    it('talent can update own profile_visibility', async () => {
      const { error } = await talent.client
        .from('profiles')
        .update({ profile_visibility: 'private' })
        .eq('id', talent.id)
      expect(error).toBeNull()

      const { data } = await talent.client
        .from('profiles')
        .select('profile_visibility')
        .eq('id', talent.id)
        .single()
      expect(data?.profile_visibility).toBe('private')

      await talent.client
        .from('profiles')
        .update({ profile_visibility: 'public' })
        .eq('id', talent.id)
    })

    it('users can only read and write their own notification preferences', async () => {
      const { error: upsertError } = await talent.client
        .from('notification_preferences')
        .upsert({
          profile_id: talent.id,
          preferences: { messages: { in_app: true, email: false } },
        })
      expect(upsertError).toBeNull()

      const { data: own, error: ownError } = await talent.client
        .from('notification_preferences')
        .select('preferences')
        .eq('profile_id', talent.id)
        .single()
      expect(ownError).toBeNull()
      expect(own).toBeTruthy()

      const { data: other } = await hirer.client
        .from('notification_preferences')
        .select('preferences')
        .eq('profile_id', talent.id)
      expect(other ?? []).toHaveLength(0)
    })

    it('talent cannot create hirer workspace defaults', async () => {
      const { error } = await talent.client
        .from('hirer_workspace_defaults')
        .upsert({
          profile_id: talent.id,
          job_defaults: { location: 'London' },
          outreach_defaults: {},
        })
      expect(error).not.toBeNull()
    })

    it('private talent are excluded from search_talent_filtered', async () => {
      await admin.from('profiles').update({ profile_visibility: 'private' }).eq('id', talent.id)
      const { data, error } = await admin.rpc('search_talent_filtered', {
        filters: {},
        result_limit: 48,
        result_offset: 0,
        result_sort: 'newest',
      })
      expect(error).toBeNull()
      const ids = ((data ?? []) as Array<{ profile_id: string }>).map(row => row.profile_id)
      expect(ids).not.toContain(talent.id)
      await admin.from('profiles').update({ profile_visibility: 'public' }).eq('id', talent.id)
    })
  })

  describe('rate limit storage', () => {
    it('authenticated users cannot read or write rate limit counters', async () => {
      const { error: selectError } = await talent.client.from('rate_limits').select('key')
      expect(selectError).not.toBeNull()
      const { error: insertError } = await talent.client
        .from('rate_limits')
        .insert({ key: 'x', window_start: new Date().toISOString(), count: 0 })
      expect(insertError).not.toBeNull()
    })

    it('authenticated users cannot call consume_rate_limit directly', async () => {
      const { error } = await talent.client.rpc('consume_rate_limit', {
        p_key: 'x',
        p_window_seconds: 60,
        p_max: 100,
      })
      expect(error).not.toBeNull()
    })
  })

  describe('messaging isolation', () => {
    it('a hirer can open a thread with a talent through the RPC', async () => {
      const { data, error } = await hirer.client.rpc('create_or_get_thread', {
        other_profile_id: talent.id,
      })
      expect(error).toBeNull()
      expect(data).toBeTruthy()
      threadId = data as string
    })

    it('talent cannot open a thread with another talent', async () => {
      const { error } = await talent.client.rpc('create_or_get_thread', {
        other_profile_id: talent2.id,
      })
      expect(error).not.toBeNull()
    })

    it('both participants can exchange and read messages', async () => {
      const { error: hirerSend } = await hirer.client
        .from('messages')
        .insert({ thread_id: threadId, sender_id: hirer.id, content: 'Hello from hirer' })
      expect(hirerSend).toBeNull()

      const { error: talentSend } = await talent.client
        .from('messages')
        .insert({ thread_id: threadId, sender_id: talent.id, content: 'Hello back' })
      expect(talentSend).toBeNull()

      const { data: messages } = await talent.client
        .from('messages')
        .select('content')
        .eq('thread_id', threadId)
      expect(messages).toHaveLength(2)
    })

    it('a non-participant cannot read the thread or its messages', async () => {
      const { data: messages } = await talent2.client
        .from('messages')
        .select('content')
        .eq('thread_id', threadId)
      expect(messages ?? []).toHaveLength(0)

      const { data: threads } = await talent2.client
        .from('message_threads')
        .select('id')
        .eq('id', threadId)
      expect(threads ?? []).toHaveLength(0)
    })

    it('a non-participant cannot inject a message into the thread', async () => {
      const { error } = await talent2.client
        .from('messages')
        .insert({ thread_id: threadId, sender_id: talent2.id, content: 'Intruding' })
      expect(error).not.toBeNull()
    })

    it('a participant cannot spoof the sender of a message', async () => {
      const { error } = await hirer.client
        .from('messages')
        .insert({ thread_id: threadId, sender_id: talent.id, content: 'Spoofed' })
      expect(error).not.toBeNull()
    })
  })

  describe('jobs and applications', () => {
    it('a hirer can create their own job and everyone authenticated can see it', async () => {
      const { data, error } = await hirer.client
        .from('jobs')
        .insert({
          hirer_id: hirer.id,
          title: 'Dancers wanted',
          description: 'Two-day shoot',
          category: 'dancer',
          location: 'London',
          status: 'open',
        })
        .select('id')
        .single()
      expect(error).toBeNull()
      jobId = data!.id

      const { data: visible } = await talent.client.from('jobs').select('id').eq('id', jobId)
      expect(visible).toHaveLength(1)
    })

    it('nobody can create a job on behalf of another hirer', async () => {
      const { error } = await talent.client
        .from('jobs')
        .insert({
          hirer_id: hirer.id,
          title: 'Fake job',
          description: 'x',
          category: 'dancer',
          location: 'x',
        })
      expect(error).not.toBeNull()
    })

    it('a talent can apply once, and only as themselves', async () => {
      const { error } = await talent.client
        .from('applications')
        .insert({ job_id: jobId, talent_id: talent.id, status: 'sent' })
      expect(error).toBeNull()

      const { error: duplicate } = await talent.client
        .from('applications')
        .insert({ job_id: jobId, talent_id: talent.id, status: 'sent' })
      expect(duplicate?.code).toBe('23505')

      const { error: impersonation } = await talent2.client
        .from('applications')
        .insert({ job_id: jobId, talent_id: talent.id, status: 'sent' })
      expect(impersonation).not.toBeNull()
    })

    it('only the job owner and the applicant can see an application', async () => {
      const { data: ownerView } = await hirer.client.from('applications').select('id').eq('job_id', jobId)
      expect(ownerView).toHaveLength(1)

      const { data: applicantView } = await talent.client.from('applications').select('id').eq('job_id', jobId)
      expect(applicantView).toHaveLength(1)

      const { data: otherHirerView } = await hirer2.client.from('applications').select('id').eq('job_id', jobId)
      expect(otherHirerView ?? []).toHaveLength(0)

      const { data: otherTalentView } = await talent2.client.from('applications').select('id').eq('job_id', jobId)
      expect(otherTalentView ?? []).toHaveLength(0)
    })

    it('only the job owner can update application status', async () => {
      const { data: updatedByOther } = await hirer2.client
        .from('applications')
        .update({ status: 'hired' })
        .eq('job_id', jobId)
        .select('id')
      expect(updatedByOther ?? []).toHaveLength(0)

      const { data: updatedByOwner, error } = await hirer.client
        .from('applications')
        .update({ status: 'shortlisted' })
        .eq('job_id', jobId)
        .select('id, status')
      expect(error).toBeNull()
      expect(updatedByOwner).toHaveLength(1)
    })
  })

  describe('outreach and shortlists', () => {
    it('outreach is only visible to its hirer and its talent', async () => {
      const { error } = await hirer.client
        .from('outreach')
        .insert({ hirer_id: hirer.id, talent_id: talent.id, message: 'We would love to work with you', status: 'sent' })
      expect(error).toBeNull()

      const { data: talentView } = await talent.client.from('outreach').select('id').eq('talent_id', talent.id)
      expect(talentView).toHaveLength(1)

      const { data: otherView } = await talent2.client.from('outreach').select('id').eq('talent_id', talent.id)
      expect(otherView ?? []).toHaveLength(0)
    })

    it('outreach cannot be sent in another hirer\'s name', async () => {
      const { error } = await talent2.client
        .from('outreach')
        .insert({ hirer_id: hirer.id, talent_id: talent2.id, message: 'Spoofed', status: 'sent' })
      expect(error).not.toBeNull()
    })

    it('shortlists are private to their owner', async () => {
      const { error } = await hirer.client
        .from('shortlists')
        .insert({ hirer_id: hirer.id, talent_id: talent.id })
      expect(error).toBeNull()

      const { data: otherView } = await hirer2.client.from('shortlists').select('id').eq('hirer_id', hirer.id)
      expect(otherView ?? []).toHaveLength(0)

      const { error: spoof } = await hirer2.client
        .from('shortlists')
        .insert({ hirer_id: hirer.id, talent_id: talent2.id })
      expect(spoof).not.toBeNull()
    })
  })

  describe('storage ownership', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])

    it('users can upload only into their own folder', async () => {
      const { error: ownUpload } = await talent.client.storage
        .from('avatars')
        .upload(`${talent.id}/photo.png`, png, { contentType: 'image/png' })
      expect(ownUpload).toBeNull()

      const { error: foreignUpload } = await talent2.client.storage
        .from('avatars')
        .upload(`${talent.id}/injected.png`, png, { contentType: 'image/png' })
      expect(foreignUpload).not.toBeNull()
    })

    it('users cannot overwrite or delete another user\'s files', async () => {
      const { error: overwrite } = await talent2.client.storage
        .from('avatars')
        .update(`${talent.id}/photo.png`, png, { contentType: 'image/png' })
      expect(overwrite).not.toBeNull()

      await talent2.client.storage.from('avatars').remove([`${talent.id}/photo.png`])
      const { data: stillThere } = await admin.storage.from('avatars').list(talent.id)
      expect((stillThere ?? []).map(f => f.name)).toContain('photo.png')
    })

    it('bucket rejects disallowed MIME types server-side', async () => {
      const { error } = await talent.client.storage
        .from('avatars')
        .upload(`${talent.id}/script.svg`, new TextEncoder().encode('<svg/>'), { contentType: 'image/svg+xml' })
      expect(error).not.toBeNull()
    })
  })
})

// Always-on guard so the file fails loudly if someone points it at production.
describe('integration environment guard', () => {
  it('refuses to run against non-local Supabase URLs', () => {
    expect(API_URL.includes('127.0.0.1') || API_URL.includes('localhost') || !stackUp).toBe(true)
  })
})
