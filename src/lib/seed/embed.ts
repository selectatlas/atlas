import * as dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'

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
}, attributes?: {
  gender: string | null
  height_cm: number | null
  languages: string[]
  nationalities: string[]
  available_now: boolean | null
  public_attributes: Record<string, unknown>
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
    attributes?.gender ? `Gender: ${attributes.gender}` : null,
    attributes?.height_cm ? `Height: ${attributes.height_cm} cm` : null,
    attributes?.languages?.length ? `Languages: ${attributes.languages.join(', ')}` : null,
    attributes?.nationalities?.length ? `Nationalities: ${attributes.nationalities.join(', ')}` : null,
    attributes?.available_now ? 'Available now' : null,
    attributes?.public_attributes && Object.keys(attributes.public_attributes).length > 0 ? `Attributes: ${JSON.stringify(attributes.public_attributes)}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

// Jobs created through the app are embedded by POST /api/jobs; seeded jobs
// bypass that route, so the embed script covers them here. Mirrors the
// source-text format in src/lib/job-embedding.ts.
async function embedAllJobs(): Promise<number> {
  console.log('\nEmbedding jobs...\n')

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, description, skills_required')

  if (error || !jobs) {
    console.error('Failed to fetch jobs:', error?.message)
    return 1
  }

  let failed = 0
  for (const job of jobs) {
    process.stdout.write(`  ${job.title.slice(0, 60)}... `)
    const sourceText = `${job.title} ${job.description} ${(job.skills_required ?? []).join(' ')}`

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: sourceText,
      })
      const embedding = JSON.stringify(response.data[0].embedding)

      const { error: upsertError } = await supabase
        .from('job_embeddings')
        .upsert({ job_id: job.id, embedding, updated_at: new Date().toISOString() })
      if (upsertError) throw new Error(upsertError.message)

      await supabase
        .from('jobs')
        .update({ embedding_status: 'complete', embedding_error: null })
        .eq('id', job.id)
      console.log('✓')
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`)
      await supabase
        .from('jobs')
        .update({ embedding_status: 'failed', embedding_error: (err as Error).message.slice(0, 500) })
        .eq('id', job.id)
      failed++
    }

    await new Promise(r => setTimeout(r, 50))
  }

  return failed
}

async function embedAll() {
  console.log('\nEmbedding all talent profiles...\n')

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_WITH_SKILLS)
    .eq('account_type', 'talent')

  if (error || !profiles) {
    console.error('Failed to fetch profiles:', error?.message)
    process.exit(1)
  }

  console.log(`Found ${profiles.length} talent profiles.\n`)

  const { data: attributeRows } = await supabase.from('talent_profiles').select('profile_id, gender, height_cm, languages, nationalities, available_now, public_attributes')
  const attributesByProfile = new Map((attributeRows ?? []).map(row => [row.profile_id, row]))

  let done = 0
  let failed = 0

  for (const profile of profiles) {
    process.stdout.write(`  ${profile.full_name}... `)

    const sourceText = buildSourceText(profile, attributesByProfile.get(profile.id))

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

  console.log(`\nProfiles done. Embedded: ${done}  Failed: ${failed}`)

  const jobFailures = await embedAllJobs()
  console.log(`\nDone.`)
  if (failed + jobFailures > 0) process.exit(1)
}

embedAll().catch(err => {
  console.error('\nEmbed script crashed:', err)
  process.exit(1)
})
