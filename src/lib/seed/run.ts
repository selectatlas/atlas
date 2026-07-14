import * as dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { SEED_PROFILES } from './data'
import { DEMO_HIRER, DEMO_PASSWORD, seedDemoWorld } from './demo-world'
import { mirrorImageToStorage } from './images'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const RESET = process.argv.includes('--reset')
const RESET_ONLY = process.argv.includes('--reset-only')
const DEMO_EMAIL_DOMAIN = '@atlas-demo.com'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function filterData(profile: (typeof SEED_PROFILES)[number]) {
  const category = profile.skills[0]?.category
  const rate = Number(profile.rates.match(/£([\d,]+)/)?.[1]?.replace(/,/g, '') ?? 0) || null
  const knownLanguages = ['English', 'Hindi', 'Tamil', 'Urdu', 'French', 'Spanish', 'German', 'Portuguese', 'Arabic']
  const languages = [...new Set(['english', ...knownLanguages.filter(language => profile.bio.toLowerCase().includes(language.toLowerCase())).map(slug)])]
  const publicAttributes: Record<string, string[] | boolean> = {}

  if (category === 'dancer') {
    publicAttributes.dance_skill_level = ['advanced_or_professional']
    publicAttributes.dance_experience = ['live_performance']
  } else if (category === 'actor') {
    publicAttributes.acting_medium = profile.skills.some(skill => /voice/i.test(skill.skill)) ? ['screen_acting', 'voice_acting'] : ['screen_acting']
    publicAttributes.spact = profile.skills.some(skill => /stunt|combat|martial|boxing/i.test(skill.skill))
  } else if (category === 'photographer_videographer') {
    const photography = profile.skills.filter(skill => /photograph/i.test(skill.skill)).map(skill => {
      const value = slug(skill.skill.replace(/ photography$/i, ''))
      return value === 'event' ? 'events' : value
    })
    const videography = profile.skills.filter(skill => /video|cinematograph/i.test(skill.skill)).map(skill => slug(skill.skill.replace(/ videography$/i, '')))
    if (photography.length > 0) publicAttributes.photography_types = photography
    if (videography.length > 0) publicAttributes.videography_types = videography
    publicAttributes.delivery_time = ['14_days']
    publicAttributes.overseas_hire = /overseas|europe/i.test(profile.bio)
  }

  return {
    birth_year: null,
    gender: null,
    height_cm: null,
    rate_min: rate,
    rate_max: rate,
    rate_unit: 'day',
    rate_currency: 'GBP',
    languages,
    nationalities: [],
    available_now: /available now|fully available/i.test(profile.availability),
    public_attributes: publicAttributes,
  }
}

async function upsertFilterData(profileId: string, profile: (typeof SEED_PROFILES)[number]) {
  return supabase.from('talent_profiles').upsert({ profile_id: profileId, ...filterData(profile) }, { onConflict: 'profile_id' })
}

// External source images are mirrored into the Supabase avatars bucket so the
// app never depends on third-party image hosts at demo time.
async function ensureStorageAvatar(profileId: string, sourceUrl: string): Promise<void> {
  const { data: current } = await supabase.from('profiles').select('avatar_url').eq('id', profileId).single()
  if (current?.avatar_url?.includes('/storage/v1/object/public/avatars/')) return

  const mirrored = await mirrorImageToStorage(supabase, {
    bucket: 'avatars',
    path: `${profileId}/avatar.jpg`,
    sourceUrl,
  })
  if (mirrored) {
    await supabase.from('profiles').update({ avatar_url: mirrored }).eq('id', profileId)
  }
}

// Database cascades handle table rows; storage objects need explicit cleanup.
async function removeStorageFolder(bucket: 'avatars' | 'covers', userId: string): Promise<void> {
  const { data: objects } = await supabase.storage.from(bucket).list(userId)
  if (objects && objects.length > 0) {
    await supabase.storage.from(bucket).remove(objects.map(object => `${userId}/${object.name}`))
  }
}

async function resetDemoUsers(): Promise<void> {
  console.log('\nResetting demo users...')
  let deleted = 0
  // Auth deletes cascade to profiles and every dependent table.
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      console.error(`Failed to list users: ${error.message}`)
      process.exit(1)
    }
    const demoUsers = data.users.filter(user => user.email?.endsWith(DEMO_EMAIL_DOMAIN))
    for (const user of demoUsers) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
      if (deleteError) {
        console.error(`  Failed to delete ${user.email}: ${deleteError.message}`)
        continue
      }
      await removeStorageFolder('avatars', user.id)
      await removeStorageFolder('covers', user.id)
      deleted++
    }
    if (data.users.length < 200) break
  }
  console.log(`  Deleted ${deleted} demo users (rows cascaded, storage cleaned).`)
}

interface CreateUserOptions {
  email: string
  full_name: string
  account_type: 'hirer' | 'talent'
}

// Returns the profile id whether the user already existed or was just created.
async function ensureUser({ email, full_name, account_type }: CreateUserOptions): Promise<{ id: string; existed: boolean } | null> {
  const { data: existing } = await supabase.from('profiles').select('id').eq('email', email).single()
  if (existing) return { id: existing.id, existed: true }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name, account_type },
  })
  if (authError || !authData.user) {
    console.log(`FAILED (auth): ${authError?.message}`)
    return null
  }
  return { id: authData.user.id, existed: false }
}

async function seedTalent(idsByEmail: Map<string, string>): Promise<number> {
  console.log(`\nSeeding ${SEED_PROFILES.length} talent profiles...\n`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (const profile of SEED_PROFILES) {
    process.stdout.write(`  ${profile.full_name}... `)

    const user = await ensureUser({ email: profile.email, full_name: profile.full_name, account_type: 'talent' })
    if (!user) {
      failed++
      continue
    }
    idsByEmail.set(profile.email, user.id)

    if (user.existed) {
      const { error: attributesError } = await upsertFilterData(user.id, profile)
      await ensureStorageAvatar(user.id, profile.avatar_url)
      console.log(attributesError ? `already exists; filter data FAILED: ${attributesError.message}` : 'already exists; filter data updated')
      if (attributesError) failed++
      skipped++
      continue
    }

    // Update the profile row created by the auth trigger with full data
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        avatar_url: profile.avatar_url,
        city: profile.city,
        country: profile.country,
        bio: profile.bio,
        rates: profile.rates,
        availability: profile.availability,
        showreel_url: profile.showreel_url,
      })
      .eq('id', user.id)

    if (profileError) {
      console.log(`FAILED (profile update): ${profileError.message}`)
      failed++
      continue
    }

    const { error: skillsError } = await supabase
      .from('talent_skills')
      .insert(
        profile.skills.map(s => ({
          profile_id: user.id,
          category: s.category,
          skill: s.skill,
          proficiency: s.proficiency,
        }))
      )

    if (skillsError) {
      console.log(`FAILED (skills): ${skillsError.message}`)
      failed++
      continue
    }

    const { error: attributesError } = await upsertFilterData(user.id, profile)
    if (attributesError) {
      console.log(`FAILED (filter data): ${attributesError.message}`)
      failed++
      continue
    }

    await ensureStorageAvatar(user.id, profile.avatar_url)

    console.log('✓')
    created++
  }

  console.log(`\nTalent done. Created: ${created}  Skipped: ${skipped}  Failed: ${failed}`)
  return failed
}

async function seedHirer(idsByEmail: Map<string, string>): Promise<boolean> {
  process.stdout.write(`\nSeeding hirer ${DEMO_HIRER.full_name}... `)

  const user = await ensureUser({ email: DEMO_HIRER.email, full_name: DEMO_HIRER.full_name, account_type: 'hirer' })
  if (!user) return false
  idsByEmail.set(DEMO_HIRER.email, user.id)

  const { error } = await supabase
    .from('profiles')
    .update({ city: DEMO_HIRER.city, country: DEMO_HIRER.country, bio: DEMO_HIRER.bio })
    .eq('id', user.id)
  if (error) {
    console.log(`FAILED (profile update): ${error.message}`)
    return false
  }

  await ensureStorageAvatar(user.id, 'https://picsum.photos/seed/atlas-northstar-logo/400/400')
  console.log(user.existed ? 'already exists ✓' : '✓')
  return true
}

async function seed() {
  if (RESET || RESET_ONLY) {
    await resetDemoUsers()
    if (RESET_ONLY) {
      console.log('\nReset complete. Re-run `npm run seed` to repopulate.')
      return
    }
  }

  const idsByEmail = new Map<string, string>()

  const talentFailures = await seedTalent(idsByEmail)
  const hirerOk = await seedHirer(idsByEmail)

  if (talentFailures > 0 || !hirerOk) {
    console.log('\nSome profiles failed; skipping demo world seed. Check errors above.')
    process.exit(1)
  }

  // The demo world clears and recreates everything scoped to the demo hirer
  // on every run, so re-running the seed always yields fresh relative dates.
  await seedDemoWorld(supabase, idsByEmail)

  console.log('\nDone. Log in as:')
  console.log(`  Hirer:  ${DEMO_HIRER.email} / ${DEMO_PASSWORD}`)
  console.log(`  Talent: priya.singh@atlas-demo.com / ${DEMO_PASSWORD}`)
  console.log('\nNext: run `npm run embed` to refresh profile and job embeddings for AI search.')
}

seed().catch(err => {
  console.error('\nSeed script crashed:', err)
  process.exit(1)
})
