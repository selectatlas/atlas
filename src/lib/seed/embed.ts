import * as dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openaiKey = process.env.OPENAI_API_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const openai = new OpenAI({ apiKey: openaiKey })

function buildSourceText(profile: {
  full_name: string
  city: string | null
  country: string | null
  bio: string | null
  rates: string | null
  availability: string | null
  talent_skills: Array<{ category: string; skill: string; proficiency: string }>
}): string {
  const skillLines = profile.talent_skills
    .map(s => `${s.skill} (${s.proficiency})`)
    .join(', ')

  const categories = [...new Set(profile.talent_skills.map(s => s.category))].join(', ')

  return [
    `Name: ${profile.full_name}`,
    `Category: ${categories}`,
    `Location: ${[profile.city, profile.country].filter(Boolean).join(', ')}`,
    `Skills: ${skillLines}`,
    profile.availability ? `Availability: ${profile.availability}` : null,
    profile.rates ? `Rate: ${profile.rates}` : null,
    profile.bio ? `Bio: ${profile.bio}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

async function embedAll() {
  console.log('\nEmbedding all talent profiles...\n')

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*, talent_skills(*)')
    .eq('account_type', 'talent')

  if (error || !profiles) {
    console.error('Failed to fetch profiles:', error?.message)
    process.exit(1)
  }

  console.log(`Found ${profiles.length} talent profiles.\n`)

  let done = 0
  let failed = 0

  for (const profile of profiles) {
    process.stdout.write(`  ${profile.full_name}... `)

    const sourceText = buildSourceText(profile)

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: sourceText,
      })
      const embedding = response.data[0].embedding

      const { error: upsertError } = await supabase
        .from('profile_embeddings')
        .upsert({
          profile_id: profile.id,
          embedding: JSON.stringify(embedding),
          source_text: sourceText,
          updated_at: new Date().toISOString(),
        })

      if (upsertError) {
        console.log(`FAILED (upsert): ${upsertError.message}`)
        failed++
      } else {
        console.log('✓')
        done++
      }
    } catch (err) {
      console.log(`FAILED (OpenAI): ${(err as Error).message}`)
      failed++
    }

    // Small delay to stay within OpenAI rate limits
    await new Promise(r => setTimeout(r, 50))
  }

  console.log(`\nDone. Embedded: ${done}  Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

embedAll().catch(err => {
  console.error('\nEmbed script crashed:', err)
  process.exit(1)
})
