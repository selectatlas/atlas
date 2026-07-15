import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

// GET /api/account/export — download everything Atlas holds about the caller
// as JSON. All queries run through the caller's own session, so RLS guarantees
// the export can only ever contain their own data.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await enforceRateLimit(`account-export:${user.id}`, 3600, 5)
  if (limited) return limited

  const [
    profile,
    skills,
    jobs,
    applications,
    outreach,
    shortlists,
    likes,
    messages,
    blocks,
    reports,
  ] = await Promise.all([
    supabase.from('profiles').select('id, account_type, full_name, avatar_url, cover_url, headline, city, country, bio, rates, availability, showreel_url, created_at').eq('id', user.id).maybeSingle(),
    supabase.from('talent_skills').select('category, skill, proficiency, created_at').eq('profile_id', user.id),
    supabase.from('jobs').select('id, title, description, category, skills_required, location, budget, status, created_at').eq('hirer_id', user.id),
    supabase.from('applications').select('job_id, status, created_at').eq('talent_id', user.id),
    supabase.from('outreach').select('talent_id, hirer_id, message, status, created_at').or(`hirer_id.eq.${user.id},talent_id.eq.${user.id}`),
    supabase.from('shortlists').select('talent_id, created_at').eq('hirer_id', user.id),
    supabase.from('profile_likes').select('talent_id, created_at').eq('user_id', user.id),
    supabase.from('messages').select('thread_id, content, created_at').eq('sender_id', user.id),
    supabase.from('blocks').select('blocked_id, created_at').eq('blocker_id', user.id),
    supabase.from('reports').select('reason, details, status, created_at').eq('reporter_id', user.id),
  ])

  const exportPayload = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    profile: profile.data ?? null,
    skills: skills.data ?? [],
    jobs: jobs.data ?? [],
    applications: applications.data ?? [],
    outreach: outreach.data ?? [],
    shortlists: shortlists.data ?? [],
    likes: likes.data ?? [],
    messages_sent: messages.data ?? [],
    blocks: blocks.data ?? [],
    reports_filed: reports.data ?? [],
  }

  return new Response(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="atlas-export-${user.id}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
