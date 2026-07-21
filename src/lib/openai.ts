import OpenAI from 'openai'
import { buildJobDraftSystemPrompt, coerceJobDraft, EMPTY_JOB_DRAFT, type JobDraft } from '@/lib/job-draft'

let openai: OpenAI | undefined

// Routes are imported while Next.js collects build-time page data, so defer
// credential validation and client creation until an API request needs OpenAI.
function getOpenAI(): OpenAI {
  if (openai) return openai

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  // Bounded latency and retries so a slow upstream cannot hold serverless
  // workers open indefinitely or silently burn credits.
  openai = new OpenAI({ apiKey, timeout: 15_000, maxRetries: 2 })
  return openai
}

export async function embedText(text: string): Promise<number[]> {
  const openai = getOpenAI()
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    // Hard cap on input size regardless of caller - bounded token spend.
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
}

export interface ParsedQuery {
  category: string | null       // dancer | actor | photographer_videographer | content_creator | null
  skills: string[]              // ["Bollywood", "Hindi"]
  location: string | null       // "London"
  availability: string | null   // "December"
  languages: string[]           // ["Hindi"]
  gender: string[]              // female | male | non_binary
  age_min: number | null
  age_max: number | null
  spact: boolean | null
}

export async function parseSearchQuery(query: string): Promise<ParsedQuery> {
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Extract structured search intent from a talent search query.
Return a JSON object with exactly these keys:
- category: one of "dancer", "actor", "photographer_videographer", "content_creator", or null
- skills: array of specific skills or style keywords (e.g. ["Bollywood", "Kathak"])
- location: city or region string, or null
- availability: availability text (month, season, etc.), or null
- languages: array of languages mentioned, or []
- gender: array containing only "female", "male", or "non_binary", or []
- age_min: minimum age explicitly requested, or null
- age_max: maximum age explicitly requested, or null
- spact: true or false only when explicitly requested, or null

Only extract what is explicitly stated. Do not infer.`,
      },
      { role: 'user', content: query },
    ],
  })

  try {
    const raw = JSON.parse(response.choices[0].message.content ?? '{}')
    return {
      category: raw.category ?? null,
      skills: Array.isArray(raw.skills) ? raw.skills : [],
      location: raw.location ?? null,
      availability: raw.availability ?? null,
      languages: Array.isArray(raw.languages) ? raw.languages : [],
      gender: Array.isArray(raw.gender) ? raw.gender : [],
      age_min: typeof raw.age_min === 'number' ? raw.age_min : null,
      age_max: typeof raw.age_max === 'number' ? raw.age_max : null,
      spact: typeof raw.spact === 'boolean' ? raw.spact : null,
    }
  } catch {
    return { category: null, skills: [], location: null, availability: null, languages: [], gender: [], age_min: null, age_max: null, spact: null }
  }
}

export interface ParsedJobQuery {
  category: string | null       // dancer | actor | photographer_videographer | content_creator | null
  role: string | null           // "backing dancer", "lead actor"
  location: string | null       // "London"
  work_type: string | null      // in_person | remote | hybrid
  availability: string | null   // "December", "this month"
  rate_min: number | null       // day rate floor, in whole currency units
  rate_max: number | null       // day rate ceiling
  keywords: string[]            // free-text terms for the FTS pass
}

const EMPTY_JOB_QUERY: ParsedJobQuery = {
  category: null, role: null, location: null, work_type: null,
  availability: null, rate_min: null, rate_max: null, keywords: [],
}

/**
 * The jobs-side mirror of parseSearchQuery: turns a talent's natural-language
 * job search into the structured fields the discover feed already filters on.
 * Same JSON-mode contract - a malformed response degrades to an empty parse so
 * the caller falls back to plain keyword search rather than failing.
 */
export async function parseJobQuery(query: string): Promise<ParsedJobQuery> {
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Extract structured search intent from a job search query written by a performer or creative looking for work.
Return a JSON object with exactly these keys:
- category: one of "dancer", "actor", "photographer_videographer", "content_creator", or null
- role: the specific role or job title mentioned (e.g. "backing dancer"), or null
- location: city or region string, or null
- work_type: one of "in_person", "remote", "hybrid", or null
- availability: timing text (month, season, "this week"), or null
- rate_min: minimum day rate as a number with no currency symbol, or null
- rate_max: maximum day rate as a number with no currency symbol, or null
- keywords: array of remaining meaningful search terms, or []

"paying over 300" sets rate_min to 300. "under 500 a day" sets rate_max to 500.
Only extract what is explicitly stated. Do not infer.`,
      },
      { role: 'user', content: query },
    ],
  })

  try {
    const raw = JSON.parse(response.choices[0].message.content ?? '{}')
    return {
      category: raw.category ?? null,
      role: typeof raw.role === 'string' ? raw.role : null,
      location: typeof raw.location === 'string' ? raw.location : null,
      work_type: typeof raw.work_type === 'string' ? raw.work_type : null,
      availability: typeof raw.availability === 'string' ? raw.availability : null,
      rate_min: typeof raw.rate_min === 'number' ? raw.rate_min : null,
      rate_max: typeof raw.rate_max === 'number' ? raw.rate_max : null,
      keywords: Array.isArray(raw.keywords) ? raw.keywords.filter((k: unknown) => typeof k === 'string') : [],
    }
  } catch {
    return { ...EMPTY_JOB_QUERY }
  }
}

// Turns a hirer's one-line brief into a structured job draft. Same JSON-mode
// contract as parseSearchQuery: a malformed or surprising response degrades to
// an empty draft (the hirer just fills the form in by hand) rather than
// throwing. Upstream API errors do propagate, so the route can answer 503.
export async function parseJobDraft(brief: string, today: string): Promise<JobDraft> {
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    // Slightly above zero: the title and description are written, not
    // extracted, and pure greedy decoding makes them read like templates.
    temperature: 0.3,
    max_tokens: 700,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildJobDraftSystemPrompt(today) },
      { role: 'user', content: brief.slice(0, 1000) },
    ],
  })

  try {
    return coerceJobDraft(JSON.parse(response.choices[0].message.content ?? '{}'))
  } catch {
    return { ...EMPTY_JOB_DRAFT }
  }
}

export type AgentMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam
export type AgentTool = OpenAI.Chat.Completions.ChatCompletionTool
export type AgentToolChoice = OpenAI.Chat.Completions.ChatCompletionToolChoiceOption

// One turn of the agentic search loop. Kept here so the OpenAI client (and its
// credential handling) never leaves this module.
export async function agentCompletion(
  messages: AgentMessage[],
  tools: AgentTool[],
  toolChoice: AgentToolChoice = 'auto',
): Promise<OpenAI.Chat.Completions.ChatCompletionMessage> {
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 1500,
    messages,
    tools,
    tool_choice: toolChoice,
  })
  return response.choices[0].message
}

export type MessageAssistMode = 'draft' | 'rephrase' | 'friendlier' | 'concise'

const ASSIST_INSTRUCTIONS: Record<MessageAssistMode, string> = {
  draft: 'Suggest the next reply the sender should write in this conversation.',
  rephrase: 'Rewrite the sender\'s draft with better flow and wording, keeping its meaning and length.',
  friendlier: 'Rewrite the sender\'s draft in a warmer, friendlier tone without adding new claims.',
  concise: 'Rewrite the sender\'s draft to be noticeably shorter while keeping all key points.',
}

export async function generateMessageAssist(params: {
  mode: MessageAssistMode
  draft?: string
  senderRole: 'hirer' | 'talent'
  otherName: string
  recentMessages: Array<{ fromMe: boolean; content: string }>
  jobTitle?: string | null
}): Promise<string> {
  const { mode, draft, senderRole, otherName, recentMessages, jobTitle } = params
  const openai = getOpenAI()

  const transcript = recentMessages
    .slice(-15)
    .map(m => `${m.fromMe ? 'Sender' : otherName}: ${m.content.slice(0, 500)}`)
    .join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: `You help write direct messages on a creative-industry talent platform. The sender is a ${senderRole === 'hirer' ? 'casting director or producer' : 'creative talent (dancer, actor, or content creator)'} messaging ${otherName}.
${ASSIST_INSTRUCTIONS[mode]}
- Plain text only, no markdown, no subject line, no signature
- 1-4 sentences, under 900 characters
- Sound human and specific to the conversation, never templated
- Do not use em dashes
- Return only the message text`,
      },
      {
        role: 'user',
        content: `${jobTitle ? `The conversation started about the job "${jobTitle}".\n` : ''}Conversation so far:
${transcript || '(no messages yet)'}
${mode === 'draft' ? '' : `\nSender's current draft:\n${(draft ?? '').slice(0, 2000)}`}`,
      },
    ],
  })
  return response.choices[0].message.content?.trim() ?? ''
}

export async function generateOutreachMessage(params: {
  hirerContext: string
  talentName: string
  talentSkills: string[]
  talentBio: string
}): Promise<string> {
  const { hirerContext, talentName, talentSkills, talentBio } = params
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: `Write a short, warm, personalised outreach message from a casting director or producer to a talent they want to work with.
- 2-3 sentences maximum
- Reference the talent's specific skills naturally
- Sound human, not templated
- Do not use em dashes
- Start with "Hi [first name],"`,
      },
      {
        role: 'user',
        content: `Hirer context: ${hirerContext}
Talent name: ${talentName}
Talent skills: ${talentSkills.join(', ')}
Talent bio excerpt: ${talentBio.slice(0, 200)}`,
      },
    ],
  })
  return response.choices[0].message.content?.trim() ?? ''
}
