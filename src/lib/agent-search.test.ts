import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/openai', () => ({
  embedText: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
  agentCompletion: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { runAgentSearch } from './agent-search'
import { agentCompletion, embedText } from '@/lib/openai'
import { createServiceClient } from '@/lib/supabase/server'

const mockAgentCompletion = agentCompletion as ReturnType<typeof vi.fn>
const mockEmbedText = embedText as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as ReturnType<typeof vi.fn>

const PROFILE = {
  id: 'p1',
  account_type: 'talent',
  full_name: 'Asha Rao',
  headline: 'Bollywood dancer',
  city: 'London',
  country: 'UK',
  bio: 'Trained in Kathak and Bollywood.',
  rates: null,
  availability: 'Available now',
  profile_visibility: 'public',
  talent_skills: [{ id: 's1', profile_id: 'p1', category: 'dancer', skill: 'Bollywood', proficiency: null, created_at: '' }],
}

function toolCallMessage(name: string, args: object, id = 'call_1') {
  return {
    role: 'assistant',
    content: null,
    tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
  }
}

function makeServiceClient(matches: Array<{ profile_id: string; similarity: number }>, profiles: object[]) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: matches, error: null }),
    from: vi.fn(() => ({
      select: () => ({
        in: () => ({
          eq: () => ({
            neq: () => Promise.resolve({ data: profiles }),
          }),
        }),
      }),
    })),
  }
}

describe('runAgentSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbedText.mockResolvedValue(new Array(1536).fill(0))
    mockCreateServiceClient.mockReturnValue(makeServiceClient([{ profile_id: 'p1', similarity: 0.8 }], [PROFILE]))
  })

  it('searches, then returns only shortlisted candidates that were actually retrieved', async () => {
    mockAgentCompletion
      .mockResolvedValueOnce(toolCallMessage('search_talent', { query: 'bollywood dancers', filters: { location: 'London' } }))
      .mockResolvedValueOnce(toolCallMessage('finish', {
        summary: 'Searched for Bollywood dancers in London.',
        shortlist: [
          { profile_id: 'p1', score: 92, reasons: ['Bollywood trained', 'Based in London'] },
          { profile_id: 'hallucinated-id', score: 99, reasons: ['Made up'] },
        ],
      }))

    const events: string[] = []
    const output = await runAgentSearch({
      query: 'bollywood dancers in London',
      filters: {},
      onEvent: event => events.push(event.message),
    })

    expect(output.results).toHaveLength(1)
    expect(output.results[0].profile.id).toBe('p1')
    expect(output.results[0].match_score).toBe(92)
    expect(output.results[0].match_reasons).toEqual(['Bollywood trained', 'Based in London'])
    expect(output.summary).toBe('Searched for Bollywood dancers in London.')
    expect(output.searches).toBe(1)
    expect(events.some(message => message.startsWith('Searching:'))).toBe(true)
  })

  it('rejects invalid model-supplied filters without touching the database', async () => {
    const service = makeServiceClient([], [])
    mockCreateServiceClient.mockReturnValue(service)
    mockAgentCompletion
      .mockResolvedValueOnce(toolCallMessage('search_talent', { query: 'actors', filters: { secret_flag: true } }))
      .mockResolvedValueOnce(toolCallMessage('finish', { summary: 'No valid search possible.', shortlist: [] }))

    const output = await runAgentSearch({ query: 'actors', filters: {} })

    expect(service.rpc).not.toHaveBeenCalled()
    expect(mockEmbedText).not.toHaveBeenCalled()
    expect(output.results).toEqual([])
    // The validation error is fed back to the model as the tool result
    const secondCallMessages = mockAgentCompletion.mock.calls[1][0]
    const toolResult = secondCallMessages.find((m: { role: string }) => m.role === 'tool')
    expect(toolResult.content).toContain('Invalid filters')
  })

  it('forces finish at the call budget instead of looping forever', async () => {
    // Model keeps searching and never volunteers a finish
    mockAgentCompletion.mockImplementation(async (_messages, _tools, toolChoice) => {
      if (typeof toolChoice === 'object' && toolChoice.function?.name === 'finish') {
        return toolCallMessage('finish', { summary: 'Budget reached.', shortlist: [{ profile_id: 'p1', score: 70, reasons: ['Closest match'] }] })
      }
      return toolCallMessage('search_talent', { query: 'more dancers' })
    })

    const output = await runAgentSearch({ query: 'dancers', filters: {} })

    expect(output.summary).toBe('Budget reached.')
    expect(output.results).toHaveLength(1)
    // 4 search turns + 1 forced-finish turn
    expect(output.searches).toBeLessThanOrEqual(4)
    expect(mockAgentCompletion.mock.calls.length).toBeLessThanOrEqual(6)
  })

  it('clamps scores and reason lengths from the model', async () => {
    mockAgentCompletion
      .mockResolvedValueOnce(toolCallMessage('search_talent', { query: 'dancers' }))
      .mockResolvedValueOnce(toolCallMessage('finish', {
        summary: 'Done.',
        shortlist: [{ profile_id: 'p1', score: 300, reasons: ['a'.repeat(500), 'b', 'c', 'd'] }],
      }))

    const output = await runAgentSearch({ query: 'dancers', filters: {} })
    expect(output.results[0].match_score).toBe(100)
    expect(output.results[0].match_reasons).toHaveLength(3)
    expect(output.results[0].match_reasons?.[0]).toHaveLength(140)
  })
})
