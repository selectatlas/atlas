import { describe, it, expect } from 'vitest'
import { resolveShellAccountType } from './auth'

// The nav, the home dashboard and the profile builder all branch on this one
// value. When they disagree you get a talent nav wrapped around a hirer page,
// which is exactly how the hirer profile editor ended up hiding the talent
// profile builder from admins in the talent workspace.
describe('resolveShellAccountType', () => {
  describe('ordinary users', () => {
    it('gives hirers the hirer shell', () => {
      expect(resolveShellAccountType('hirer', false, undefined)).toBe('hirer')
    })

    it('gives talent the talent shell', () => {
      expect(resolveShellAccountType('talent', false, undefined)).toBe('talent')
    })

    it('defaults an unknown or pre-onboarding account to the talent shell', () => {
      expect(resolveShellAccountType(null, false, undefined)).toBe('talent')
      expect(resolveShellAccountType('', false, undefined)).toBe('talent')
    })

    it('ignores the admin view cookie for non-admins', () => {
      expect(resolveShellAccountType('hirer', false, 'talent')).toBe('hirer')
      expect(resolveShellAccountType('talent', false, 'hirer')).toBe('talent')
    })
  })

  describe('platform admins', () => {
    it('defaults to the hirer shell', () => {
      expect(resolveShellAccountType('hirer', true, undefined)).toBe('hirer')
      expect(resolveShellAccountType('talent', true, undefined)).toBe('hirer')
    })

    it('flips to the talent shell when the switcher cookie is set', () => {
      expect(resolveShellAccountType('hirer', true, 'talent')).toBe('talent')
    })

    it('treats any other cookie value as the hirer shell', () => {
      expect(resolveShellAccountType('hirer', true, 'hirer')).toBe('hirer')
      expect(resolveShellAccountType('hirer', true, 'nonsense')).toBe('hirer')
    })
  })
})
