import * as dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { SEED_PROFILES } from './data'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function seed() {
  console.log(`\nSeeding ${SEED_PROFILES.length} talent profiles...\n`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (const profile of SEED_PROFILES) {
    process.stdout.write(`  ${profile.full_name}... `)

    // Check if user already exists (idempotent re-run support)
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', profile.email)
      .single()

    if (existing) {
      console.log('already exists, skipping')
      skipped++
      continue
    }

    // Create the auth user - trigger auto-creates the profile row
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: profile.email,
      password: 'CastdDemo2025!',
      email_confirm: true,
      user_metadata: {
        full_name: profile.full_name,
        account_type: 'talent',
      },
    })

    if (authError || !authData.user) {
      console.log(`FAILED (auth): ${authError?.message}`)
      failed++
      continue
    }

    const userId = authData.user.id

    // Update the profile row created by the trigger with full data
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
      .eq('id', userId)

    if (profileError) {
      console.log(`FAILED (profile update): ${profileError.message}`)
      failed++
      continue
    }

    // Insert skills
    const { error: skillsError } = await supabase
      .from('talent_skills')
      .insert(
        profile.skills.map(s => ({
          profile_id: userId,
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

    console.log('✓')
    created++
  }

  console.log(`\nDone.`)
  console.log(`  Created: ${created}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed:  ${failed}`)

  if (failed > 0) {
    console.log('\nSome profiles failed. Check errors above.')
    process.exit(1)
  }
}

seed().catch(err => {
  console.error('\nSeed script crashed:', err)
  process.exit(1)
})
