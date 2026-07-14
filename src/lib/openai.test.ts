import { afterEach, describe, expect, it, vi } from 'vitest'

const originalApiKey = process.env.OPENAI_API_KEY

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY
  } else {
    process.env.OPENAI_API_KEY = originalApiKey
  }
  vi.resetModules()
})

describe('OpenAI client initialization', () => {
  it('allows the module to be imported without credentials', async () => {
    delete process.env.OPENAI_API_KEY
    vi.resetModules()

    await expect(import('./openai')).resolves.toBeDefined()
  })

  it('reports a missing key when an OpenAI operation is requested', async () => {
    delete process.env.OPENAI_API_KEY
    vi.resetModules()
    const { embedText } = await import('./openai')

    await expect(embedText('test')).rejects.toThrow('OPENAI_API_KEY is not configured')
  })
})
