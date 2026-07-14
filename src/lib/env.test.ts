import { describe, it, expect } from 'vitest'
import { missingServerEnv, assertServerEnv, SERVER_ONLY_ENV } from './env'

const complete = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x',
  OPENAI_API_KEY: 'sk-x',
}

describe('missingServerEnv', () => {
  it('returns nothing when every variable is set', () => {
    expect(missingServerEnv(complete)).toEqual([])
  })

  it('names each missing variable', () => {
    expect(missingServerEnv({ ...complete, OPENAI_API_KEY: undefined })).toEqual(['OPENAI_API_KEY'])
    expect(missingServerEnv({})).toHaveLength(4)
  })

  it('treats empty and whitespace values as missing', () => {
    expect(missingServerEnv({ ...complete, SUPABASE_SERVICE_ROLE_KEY: '  ' })).toEqual([
      'SUPABASE_SERVICE_ROLE_KEY',
    ])
  })
})

describe('assertServerEnv', () => {
  it('passes on a complete environment', () => {
    expect(() => assertServerEnv(complete)).not.toThrow()
  })

  it('throws naming the missing variable, never its value', () => {
    expect(() => assertServerEnv({ ...complete, OPENAI_API_KEY: '' })).toThrow(/OPENAI_API_KEY/)
  })

  it('rejects a non-URL Supabase setting', () => {
    expect(() => assertServerEnv({ ...complete, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    )
  })

  it('server-only secrets are not NEXT_PUBLIC_ prefixed', () => {
    for (const name of SERVER_ONLY_ENV) {
      expect(name.startsWith('NEXT_PUBLIC_')).toBe(false)
    }
  })
})
