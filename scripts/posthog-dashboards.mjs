// Provisions Atlas PostHog dashboards + insights via the PostHog REST API.
// Idempotent: matches dashboards and insights by exact name, updates in place.
//
// Usage: npm run posthog:dashboards
//
// Required in .env.local (script-only, never used by the app at runtime):
//   POSTHOG_PERSONAL_API_KEY  — personal API key (phx_...) with insight:write,
//                               dashboard:write and project:read scopes
// Optional:
//   POSTHOG_PROJECT_ID        — numeric project id (auto-discovered if omitted)
//   POSTHOG_API_HOST          — defaults to https://us.posthog.com

import * as dotenv from 'dotenv'
import path from 'node:path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
const apiHost = (process.env.POSTHOG_API_HOST ?? 'https://us.posthog.com').replace(/\/$/, '')

if (!apiKey) {
  console.error(
    'Missing POSTHOG_PERSONAL_API_KEY in .env.local.\n' +
      'Create one at PostHog → Settings → Personal API Keys with scopes:\n' +
      '  insight:write, dashboard:write, project:read',
  )
  process.exit(1)
}

async function api(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(`${apiHost}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${pathname} → ${res.status}: ${text.slice(0, 500)}`)
  }
  return res.json()
}

// ── Query builders (PostHog query schema: InsightVizNode) ───────────────────

function event(name, extra = {}) {
  return { kind: 'EventsNode', event: name, name: name ?? 'All events', ...extra }
}

function trends(series, { interval = 'week', dateFrom = '-90d', display = 'ActionsLineGraph' } = {}) {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'TrendsQuery',
      series,
      interval,
      dateRange: { date_from: dateFrom },
      trendsFilter: { display },
    },
  }
}

function funnel(series, { dateFrom = '-30d' } = {}) {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'FunnelsQuery',
      series,
      dateRange: { date_from: dateFrom },
      funnelsFilter: { funnelVizType: 'steps' },
    },
  }
}

// ── Dashboard definitions (from events instrumented in src/) ────────────────

const DASHBOARDS = [
  {
    name: 'Atlas · Investor Overview',
    description: 'Headline growth metrics for the investor walkthrough.',
    insights: [
      {
        name: 'Total signups (all time)',
        query: trends([event('user_signed_up')], { interval: 'month', dateFrom: 'all', display: 'BoldNumber' }),
      },
      { name: 'Signups over time', query: trends([event('user_signed_up')]) },
      {
        name: 'Weekly active users',
        query: trends([event(null, { math: 'dau' })], { interval: 'week', dateFrom: '-90d' }),
      },
      {
        name: 'AI searches performed',
        query: trends([event('ai_search_performed'), event('agent_search_performed')]),
      },
      { name: 'Outreach messages sent', query: trends([event('outreach_message_sent')]) },
      { name: 'Jobs created', query: trends([event('job_created')]) },
    ],
  },
  {
    name: 'Atlas · Hirer Funnel',
    description: 'Hirer activation: signup → search → shortlist → outreach.',
    insights: [
      {
        name: 'Hirer activation funnel',
        query: funnel([
          event('user_signed_up'),
          event('ai_search_performed'),
          event('talent_shortlisted'),
          event('outreach_message_sent'),
        ]),
      },
      {
        name: 'Shortlists over time',
        query: trends([event('talent_shortlisted'), event('talent_unshortlisted')], {
          interval: 'day',
          dateFrom: '-30d',
        }),
      },
      {
        name: 'Outreach generated vs sent',
        query: trends([event('outreach_message_generated'), event('outreach_message_sent')]),
      },
    ],
  },
  {
    name: 'Atlas · Talent Funnel',
    description: 'Talent activation: signup → application, plus discover engagement.',
    insights: [
      {
        name: 'Talent activation funnel',
        query: funnel([event('user_signed_up'), event('job_application_submitted')]),
      },
      {
        name: 'Applications over time',
        query: trends([event('job_application_submitted')], { interval: 'day', dateFrom: '-30d' }),
      },
      {
        name: 'Discover activity: passes vs applications',
        query: trends([event('job_passed'), event('job_application_submitted')], {
          interval: 'day',
          dateFrom: '-30d',
        }),
      },
    ],
  },
  {
    name: 'Atlas · AI Search Health',
    description: 'Search volume, reach, and latency for the headline AI search feature.',
    insights: [
      {
        name: 'Search volume by type',
        query: trends([event('ai_search_performed'), event('agent_search_performed')], {
          interval: 'day',
          dateFrom: '-30d',
        }),
      },
      {
        name: 'Unique searchers',
        query: trends([event('ai_search_performed', { math: 'dau' })], { interval: 'week', dateFrom: '-90d' }),
      },
      {
        // Populates once ai_search_performed captures a duration_ms property.
        name: 'AI search p95 latency (ms)',
        query: trends([event('ai_search_performed', { math: 'p95', math_property: 'duration_ms' })], {
          interval: 'day',
          dateFrom: '-30d',
        }),
      },
    ],
  },
]

// ── Provisioning ─────────────────────────────────────────────────────────────

async function resolveProjectId() {
  if (process.env.POSTHOG_PROJECT_ID) return process.env.POSTHOG_PROJECT_ID
  const project = await api('/api/projects/@current/')
  return project.id
}

async function findByName(projectId, resource, name) {
  const data = await api(
    `/api/projects/${projectId}/${resource}/?search=${encodeURIComponent(name)}&limit=100`,
  )
  return (data.results ?? []).find((r) => r.name === name && !r.deleted) ?? null
}

async function ensureDashboard(projectId, { name, description }) {
  const existing = await findByName(projectId, 'dashboards', name)
  if (existing) {
    console.log(`  dashboard exists: ${name} (#${existing.id})`)
    return existing
  }
  const created = await api(`/api/projects/${projectId}/dashboards/`, {
    method: 'POST',
    body: { name, description, pinned: true },
  })
  console.log(`  dashboard created: ${name} (#${created.id})`)
  return created
}

async function ensureInsight(projectId, dashboardId, { name, query }) {
  const existing = await findByName(projectId, 'insights', name)
  if (existing) {
    const dashboards = [...new Set([...(existing.dashboards ?? []), dashboardId])]
    await api(`/api/projects/${projectId}/insights/${existing.id}/`, {
      method: 'PATCH',
      body: { query, dashboards },
    })
    console.log(`    insight updated: ${name}`)
    return
  }
  await api(`/api/projects/${projectId}/insights/`, {
    method: 'POST',
    body: { name, query, dashboards: [dashboardId], saved: true },
  })
  console.log(`    insight created: ${name}`)
}

const projectId = await resolveProjectId()
console.log(`Provisioning PostHog dashboards for project ${projectId} on ${apiHost}\n`)

const urls = []
for (const def of DASHBOARDS) {
  console.log(def.name)
  const dashboard = await ensureDashboard(projectId, def)
  for (const insight of def.insights) {
    await ensureInsight(projectId, dashboard.id, insight)
  }
  urls.push(`${apiHost}/project/${projectId}/dashboard/${dashboard.id}`)
  console.log()
}

console.log('Done. Dashboards:')
for (const url of urls) console.log(`  ${url}`)
