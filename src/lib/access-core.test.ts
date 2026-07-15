import { describe, it, expect } from 'vitest'
import { canActAsHirer, canActAsTalent, resolveCallerAccess } from '@/lib/access-core'

describe('access-core', () => {
  it('lets platform admins act as hirers and talent', () => {
    expect(canActAsHirer('talent', true)).toBe(true)
    expect(canActAsTalent('hirer', true)).toBe(true)
  })

  it('keeps marketplace roles isolated for normal users', () => {
    expect(canActAsHirer('talent', false)).toBe(false)
    expect(canActAsTalent('hirer', false)).toBe(false)
  })

  it('resolves dual access for admins', () => {
    const access = resolveCallerAccess('u1', 'talent', 'owner')
    expect(access.canHirer).toBe(true)
    expect(access.canTalent).toBe(true)
  })
})
