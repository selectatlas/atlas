import { embedText, agentCompletion, type AgentMessage, type AgentTool } from '@/lib/openai'
import { createServiceClient } from '@/lib/supabase/server'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { filtersToDatabase, parseSearchFilterObject, type SearchFilters } from '@/lib/search-filters'
import { TALENT_FILTERS, type TalentFilterDefinition } from '@/lib/filter-taxonomy'
import type { Profile, TalentSkill, TalentSearchResult } from '@/types'

// Hard budget for one agent run: at most MAX_LLM_CALLS model turns and
// MAX_SEARCHES vector searches, so a confused model cannot burn unbounded
// OpenAI credit or hold a serverless worker open.
const MAX_LLM_CALLS = 6
const MAX_SEARCHES = 4
const CANDIDATES_PER_SEARCH = 20
const MAX_SHORTLIST = 12

type ProfileWithSkills = Profile & { talent_skills: TalentSkill[] }

export interface AgentSearchStatus {
  type: 'status'
  message: string
}

export interface AgentSearchOutput {
  summary: string
  results: TalentSearchResult[]
  searches: number
}

// Compact, model-facing view of a candidate. Built exclusively from the
// public profile selection so nothing leaves the existing visibility boundary.
function toCandidateSummary(profile: ProfileWithSkills, similarity: number) {
  return {
    profile_id: profile.id,
    name: profile.full_name,
    headline: profile.headline,
    city: profile.city,
    country: profile.country,
    availability: profile.availability,
    rates: profile.rates,
    bio: (profile.bio ?? '').slice(0, 400),
    skills: (profile.talent_skills ?? []).map(skill => `${skill.category}: ${skill.skill}`),
    similarity: Math.round(similarity * 100) / 100,
  }
}

const FILTER_GUIDE = (TALENT_FILTERS as readonly TalentFilterDefinition[]).map(definition => {
  const scope = definition.categories === 'all' ? '' : ` (only for category: ${definition.categories.join(', ')})`
  const options = definition.options ? ` values: ${definition.options.map(option => option.value).join(' | ')}${definition.allowCustom ? ' | custom' : ''}` : ''
  const range = definition.kind === 'range' ? ` {min, max}${definition.unit ? ` in ${definition.unit}` : ''}` : ''
  return `- ${definition.key} [${definition.kind}]${scope}${range}${options}`
}).join('\n')

const SYSTEM_PROMPT = `You are a talent-search agent for a casting platform. A hirer gives you a brief; you find the best matching talent by calling tools.

How to work:
1. Break the brief into one or more search_talent calls. Use a focused natural-language query per call plus structured filters where the brief is explicit. Do not invent constraints that are not in the brief.
2. Read the returned candidates critically. If results are weak or empty, adjust: relax the least important constraint, rephrase the query, or split a multi-role brief into separate searches. Note any constraint you relaxed.
3. When you have enough evidence, call finish with a shortlist of the strongest candidates (best first). Only include candidates that genuinely fit; an empty shortlist with an honest summary beats padding. Each reason must cite something concrete from the candidate's profile.

Available filters for search_talent (omit any you don't need):
${FILTER_GUIDE}

Rules:
- You have at most ${MAX_SEARCHES} searches; make them count.
- Never fabricate candidates or profile details. Only shortlist profile_ids returned by search_talent.
- The summary is shown to the hirer: 1-3 plain sentences on what you searched and any trade-offs made. No markdown.`

const TOOLS: AgentTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_talent',
      description: 'Semantic vector search over talent profiles, optionally narrowed by structured filters. Returns up to 20 candidate summaries.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural-language description of the talent to find (embedded for similarity search)' },
          filters: { type: 'object', description: 'Structured filters using the documented keys. Multi filters take arrays of option values; range filters take {min, max}.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'Return the final shortlist to the hirer. Call exactly once, when done searching.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '1-3 sentence plain-text summary of what was searched and any constraints relaxed' },
          shortlist: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                profile_id: { type: 'string' },
                score: { type: 'number', description: 'Fit score 0-100' },
                reasons: { type: 'array', items: { type: 'string' }, description: 'Up to 3 short reasons citing the profile' },
              },
              required: ['profile_id', 'score', 'reasons'],
            },
          },
        },
        required: ['summary', 'shortlist'],
      },
    },
  },
]

function describeFilters(filters: SearchFilters) {
  const keys = Object.keys(filters)
  return keys.length > 0 ? ` (filters: ${keys.join(', ')})` : ''
}

async function executeSearch(
  rawQuery: unknown,
  rawFilters: unknown,
  candidates: Map<string, ProfileWithSkills>,
): Promise<string> {
  const query = typeof rawQuery === 'string' ? rawQuery.trim().slice(0, 500) : ''
  if (!query) return JSON.stringify({ error: 'query is required' })

  // The model's filters cross a trust boundary: validate through the same
  // parser as user-supplied filters before they reach SQL.
  const parsed = parseSearchFilterObject(rawFilters ?? {})
  if (!parsed.ok) return JSON.stringify({ error: `Invalid filters: ${parsed.error}. Retry with corrected filters.` })

  const embedding = await embedText(query)
  const service = createServiceClient()
  const { data: matches, error } = await service.rpc('match_talent_filtered', {
    query_embedding: embedding,
    filters: filtersToDatabase(parsed.filters),
    match_count: CANDIDATES_PER_SEARCH,
  })
  if (error) return JSON.stringify({ error: 'Search backend failed. Try again with different parameters.' })

  const rows = (matches ?? []) as Array<{ profile_id: string; similarity: number }>
  if (rows.length === 0) return JSON.stringify({ candidates: [], note: 'No matches. Consider relaxing a constraint.' })

  const similarityMap = new Map(rows.map(row => [row.profile_id, row.similarity]))
  const { data: profiles } = await service
    .from('profiles')
    .select(PUBLIC_PROFILE_WITH_SKILLS)
    .in('id', rows.map(row => row.profile_id))
    .eq('account_type', 'talent')
    .neq('profile_visibility', 'private')

  const visible = (profiles ?? []) as unknown as ProfileWithSkills[]
  for (const profile of visible) candidates.set(profile.id, profile)

  const summaries = visible
    .map(profile => toCandidateSummary(profile, similarityMap.get(profile.id) ?? 0))
    .sort((a, b) => b.similarity - a.similarity)
  return JSON.stringify({ candidates: summaries })
}

function buildOutput(rawArgs: unknown, candidates: Map<string, ProfileWithSkills>, searches: number): AgentSearchOutput {
  const args = (rawArgs ?? {}) as { summary?: unknown; shortlist?: unknown }
  const summary = typeof args.summary === 'string' ? args.summary.trim().slice(0, 600) : ''
  const shortlist = Array.isArray(args.shortlist) ? args.shortlist : []

  const seen = new Set<string>()
  const results: TalentSearchResult[] = []
  for (const entry of shortlist) {
    if (results.length >= MAX_SHORTLIST) break
    if (!entry || typeof entry !== 'object') continue
    const { profile_id, score, reasons } = entry as { profile_id?: unknown; score?: unknown; reasons?: unknown }
    if (typeof profile_id !== 'string' || seen.has(profile_id)) continue
    // Only profiles actually returned by a search can be shortlisted - a
    // hallucinated ID must never resolve to a real profile.
    const profile = candidates.get(profile_id)
    if (!profile) continue
    seen.add(profile_id)
    results.push({
      profile,
      match_score: Math.min(100, Math.max(0, Math.round(typeof score === 'number' ? score : 0))),
      match_reasons: (Array.isArray(reasons) ? reasons : [])
        .filter((reason): reason is string => typeof reason === 'string')
        .map(reason => reason.slice(0, 140))
        .slice(0, 3),
    })
  }

  return { summary, results, searches }
}

export async function runAgentSearch(params: {
  query: string
  filters: SearchFilters
  onEvent?: (event: AgentSearchStatus) => void
}): Promise<AgentSearchOutput> {
  const { query, filters, onEvent } = params
  const candidates = new Map<string, ProfileWithSkills>()
  let searches = 0

  const messages: AgentMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Brief: ${query}\n\nFilters the hirer has already set in the UI (treat as hard constraints): ${JSON.stringify(filters)}`,
    },
  ]

  for (let call = 1; call <= MAX_LLM_CALLS; call++) {
    const forceFinish = call === MAX_LLM_CALLS || searches >= MAX_SEARCHES
    const message = await agentCompletion(
      messages,
      TOOLS,
      forceFinish ? { type: 'function', function: { name: 'finish' } } : 'auto',
    )
    messages.push(message as AgentMessage)

    const toolCalls = message.tool_calls ?? []
    if (toolCalls.length === 0) {
      // Text-only turn: remind the model it must act through tools.
      messages.push({ role: 'user', content: 'Respond only via the search_talent or finish tools.' })
      continue
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function') continue
      let args: unknown = {}
      try {
        args = JSON.parse(toolCall.function.arguments || '{}')
      } catch {
        args = {}
      }

      if (toolCall.function.name === 'finish') {
        return buildOutput(args, candidates, searches)
      }

      if (toolCall.function.name === 'search_talent') {
        const { query: searchQuery, filters: searchFilters } = (args ?? {}) as { query?: unknown; filters?: unknown }
        let content: string
        if (searches >= MAX_SEARCHES) {
          content = JSON.stringify({ error: 'Search budget exhausted. Call finish with what you have.' })
        } else {
          searches++
          const parsed = parseSearchFilterObject(searchFilters ?? {})
          onEvent?.({
            type: 'status',
            message: `Searching: "${String(typeof searchQuery === 'string' ? searchQuery : query).slice(0, 80)}"${describeFilters(parsed.ok ? parsed.filters : {})}`,
          })
          content = await executeSearch(searchQuery, searchFilters, candidates)
        }
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content })
      } else {
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: 'Unknown tool' }) })
      }
    }

    if (candidates.size > 0) {
      onEvent?.({ type: 'status', message: `Reviewing ${candidates.size} candidate${candidates.size === 1 ? '' : 's'}…` })
    }
  }

  // The forced finish on the last call should make this unreachable; return
  // an honest empty result rather than throwing if the model misbehaves.
  return { summary: 'The search could not be completed. Please try a simpler brief.', results: [], searches }
}
