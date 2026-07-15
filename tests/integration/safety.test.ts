import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import {
  adminClient,
  createTestUser,
  deleteTestUsers,
  isStackRunning,
  type TestUser,
} from './helpers'

// Block/report enforcement against the real database (migration 011).
// Blocking must hold at the DB layer: RPC, message policies, outreach policy.

const stackUp = await isStackRunning()

describe.skipIf(!stackUp)('marketplace safety (real database)', () => {
  let admin: SupabaseClient
  let hirer: TestUser
  let talent: TestUser
  let bystander: TestUser

  beforeAll(async () => {
    admin = adminClient()
    ;[hirer, talent, bystander] = await Promise.all([
      createTestUser(admin, 'hirer', 'safety-hirer'),
      createTestUser(admin, 'talent', 'safety-talent'),
      createTestUser(admin, 'talent', 'safety-bystander'),
    ])
  })

  afterAll(async () => {
    if (admin) await deleteTestUsers(admin, [hirer, talent, bystander].filter(Boolean))
  })

  describe('blocks', () => {
    it('users can only see and manage their own block list', async () => {
      const { error } = await talent.client
        .from('blocks')
        .insert({ blocker_id: talent.id, blocked_id: hirer.id })
      expect(error).toBeNull()

      const { data: own } = await talent.client.from('blocks').select('blocked_id')
      expect(own).toHaveLength(1)

      const { data: foreign } = await bystander.client
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', talent.id)
      expect(foreign ?? []).toHaveLength(0)

      const { error: spoof } = await bystander.client
        .from('blocks')
        .insert({ blocker_id: talent.id, blocked_id: bystander.id })
      expect(spoof).not.toBeNull()
    })

    it('a blocked hirer cannot open a thread with the talent', async () => {
      const { error } = await hirer.client.rpc('create_or_get_thread', {
        other_profile_id: talent.id,
      })
      expect(error).not.toBeNull()
    })

    it('a blocked hirer cannot send outreach to the talent', async () => {
      const { error } = await hirer.client
        .from('outreach')
        .insert({ hirer_id: hirer.id, talent_id: talent.id, message: 'Hello', status: 'sent' })
      expect(error).not.toBeNull()
    })

    it('existing threads go quiet when a participant blocks the other', async () => {
      // Bystander talent has no block; hirer can open a thread with them
      const { data: threadId, error } = await hirer.client.rpc('create_or_get_thread', {
        other_profile_id: bystander.id,
      })
      expect(error).toBeNull()

      const { error: beforeBlock } = await hirer.client
        .from('messages')
        .insert({ thread_id: threadId, sender_id: hirer.id, content: 'Before block' })
      expect(beforeBlock).toBeNull()

      // Bystander blocks the hirer; the hirer can no longer message the thread
      await bystander.client.from('blocks').insert({ blocker_id: bystander.id, blocked_id: hirer.id })
      const { error: afterBlock } = await hirer.client
        .from('messages')
        .insert({ thread_id: threadId, sender_id: hirer.id, content: 'After block' })
      expect(afterBlock).not.toBeNull()

      // ...and the blocker cannot message them either (block cuts both ways)
      const { error: blockerSend } = await bystander.client
        .from('messages')
        .insert({ thread_id: threadId, sender_id: bystander.id, content: 'Should also fail' })
      expect(blockerSend).not.toBeNull()

      // Unblocking restores the conversation
      await bystander.client.from('blocks').delete().eq('blocker_id', bystander.id).eq('blocked_id', hirer.id)
      const { error: afterUnblock } = await hirer.client
        .from('messages')
        .insert({ thread_id: threadId, sender_id: hirer.id, content: 'After unblock' })
      expect(afterUnblock).toBeNull()
    })

    it('unblocking restores contact for new threads', async () => {
      await talent.client.from('blocks').delete().eq('blocker_id', talent.id).eq('blocked_id', hirer.id)
      const { error } = await hirer.client.rpc('create_or_get_thread', {
        other_profile_id: talent.id,
      })
      expect(error).toBeNull()
    })
  })

  describe('reports', () => {
    it('users can file reports and read only their own', async () => {
      const { error } = await talent.client.from('reports').insert({
        reporter_id: talent.id,
        reported_profile_id: hirer.id,
        reason: 'harassment',
        details: 'Integration test report',
      })
      expect(error).toBeNull()

      const { data: own } = await talent.client.from('reports').select('id, status')
      expect(own).toHaveLength(1)
      expect(own![0].status).toBe('open')

      // The reported user cannot see reports about them
      const { data: aboutMe } = await hirer.client
        .from('reports')
        .select('id')
        .eq('reported_profile_id', hirer.id)
      expect(aboutMe ?? []).toHaveLength(0)

      // Reports cannot be filed in someone else's name
      const { error: spoof } = await bystander.client.from('reports').insert({
        reporter_id: talent.id,
        reported_profile_id: hirer.id,
        reason: 'spam',
      })
      expect(spoof).not.toBeNull()
    })

    it('reporters cannot resolve their own reports', async () => {
      const { data } = await talent.client
        .from('reports')
        .update({ status: 'resolved' })
        .eq('reporter_id', talent.id)
        .select('id')
      expect(data ?? []).toHaveLength(0)
    })
  })

  describe('account deletion cascade', () => {
    it('deleting the auth user removes every dependent row', async () => {
      const doomed = await createTestUser(admin, 'talent', 'safety-doomed')

      // Give the account data in several tables
      await admin.from('talent_skills').insert({
        profile_id: doomed.id, category: 'dancer', skill: 'Salsa', proficiency: 'expert',
      })
      await doomed.client.from('blocks').insert({ blocker_id: doomed.id, blocked_id: hirer.id })
      await doomed.client.from('reports').insert({
        reporter_id: doomed.id, reported_profile_id: hirer.id, reason: 'other',
      })

      const { error } = await admin.auth.admin.deleteUser(doomed.id)
      expect(error).toBeNull()

      const [profile, skills, blocks, reports] = await Promise.all([
        admin.from('profiles').select('id').eq('id', doomed.id),
        admin.from('talent_skills').select('id').eq('profile_id', doomed.id),
        admin.from('blocks').select('id').eq('blocker_id', doomed.id),
        admin.from('reports').select('id').eq('reporter_id', doomed.id),
      ])
      expect(profile.data ?? []).toHaveLength(0)
      expect(skills.data ?? []).toHaveLength(0)
      expect(blocks.data ?? []).toHaveLength(0)
      expect(reports.data ?? []).toHaveLength(0)
    })
  })
})
