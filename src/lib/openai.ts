import OpenAI from 'openai'

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
