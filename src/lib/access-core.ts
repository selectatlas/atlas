import type { PlatformAdminRole } from '@/types'

export type CallerAccess = {
  userId: string
  accountType: 'hirer' | 'talent' | null
  isPlatformAdmin: boolean
  adminRole: PlatformAdminRole | null
  canHirer: boolean
  canTalent: boolean
}

export function canActAsHirer(
  accountType: string | null | undefined,
  isPlatformAdmin: boolean,
): boolean {
  return accountType === 'hirer' || isPlatformAdmin
}

export function canActAsTalent(
  accountType: string | null | undefined,
  isPlatformAdmin: boolean,
): boolean {
  return accountType === 'talent' || isPlatformAdmin
}

export function resolveCallerAccess(
  userId: string,
  accountType: string | null | undefined,
  adminRole: PlatformAdminRole | null,
): CallerAccess {
  const isPlatformAdmin = adminRole !== null
  const typed =
    accountType === 'hirer' || accountType === 'talent' ? accountType : null

  return {
    userId,
    accountType: typed,
    isPlatformAdmin,
    adminRole,
    canHirer: canActAsHirer(typed, isPlatformAdmin),
    canTalent: canActAsTalent(typed, isPlatformAdmin),
  }
}
