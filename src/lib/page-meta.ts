import type { PageBreadcrumbItem } from '@/components/layout/PageBreadcrumbs'

export type PageMeta = {
  breadcrumbs: PageBreadcrumbItem[]
  eyebrow?: string
  title?: string
  description?: string
}

const HIRER_STATIC: Record<string, PageMeta> = {
  '/home': {
    breadcrumbs: [{ label: 'Dashboard' }],
    eyebrow: 'Dashboard',
    title: 'Hirer workspace',
    description: 'Your pipeline, outreach, and saved talent at a glance.',
  },
  '/search': {
    breadcrumbs: [{ label: 'Workspace', href: '/home' }, { label: 'Search' }],
    eyebrow: 'Workspace',
    title: 'Find the right talent',
    description: 'Describe the brief in your own words. Atlas will surface the people most likely to fit.',
  },
  '/shortlists': {
    breadcrumbs: [{ label: 'Workspace', href: '/home' }, { label: 'Saved talent' }],
    eyebrow: 'Workspace',
    title: 'Saved talent',
    description: 'Use the bookmark on a profile to shortlist someone for a cast. Use the heart to like a profile you want to revisit.',
  },
  '/my-jobs': {
    breadcrumbs: [{ label: 'Workspace', href: '/home' }, { label: 'My jobs' }],
    eyebrow: 'Workspace',
    title: 'My jobs',
    description: 'Manage your briefs and keep great talent moving.',
  },
  '/my-jobs/new': {
    breadcrumbs: [{ label: 'Jobs', href: '/my-jobs' }, { label: 'Post a job' }],
    eyebrow: 'Workspace',
    title: 'Post a job',
  },
  '/outreach': {
    breadcrumbs: [{ label: 'Workspace', href: '/home' }, { label: 'Outreach' }],
    eyebrow: 'Workspace',
    title: 'Outreach',
    description: 'Keep track of every message and response.',
  },
  '/messages': {
    breadcrumbs: [{ label: 'Workspace', href: '/home' }, { label: 'Messages' }],
    eyebrow: 'Workspace',
    title: 'Messages',
    description: 'All your conversations in one place.',
  },
  '/profile': {
    breadcrumbs: [{ label: 'Account', href: '/settings' }, { label: 'Profile' }],
    eyebrow: 'Account',
    title: 'My profile',
  },
  '/settings': {
    breadcrumbs: [{ label: 'Account', href: '/settings' }, { label: 'Settings' }],
    eyebrow: 'Account',
    title: 'Settings',
    description: 'Manage account, notifications, and workspace defaults.',
  },
  '/notifications': {
    breadcrumbs: [{ label: 'Workspace', href: '/home' }, { label: 'Notifications' }],
    eyebrow: 'Workspace',
    title: 'Notifications',
    description: 'Unread messages, applications, and outreach responses.',
  },
  '/pro': {
    breadcrumbs: [{ label: 'Workspace', href: '/home' }, { label: 'Atlas Pro' }],
    eyebrow: 'Plans',
    title: 'Atlas Pro',
    description: 'Hire with an edge - vetted talent, alerts that keep scouting, and a team on call.',
  },
}

const TALENT_STATIC: Record<string, PageMeta> = {
  '/home': {
    breadcrumbs: [{ label: 'Dashboard' }],
    eyebrow: 'Dashboard',
    title: 'Talent workspace',
    description: 'Your applications, messages, and profile progress.',
  },
  '/discover': {
    breadcrumbs: [{ label: 'Opportunities', href: '/discover' }, { label: 'Discover' }],
    eyebrow: 'Your opportunities',
    title: 'Discover jobs',
    description: 'Browse roles matched to your skills and availability.',
  },
  '/messages': {
    breadcrumbs: [{ label: 'Account', href: '/home' }, { label: 'Messages' }],
    eyebrow: 'Workspace',
    title: 'Messages',
    description: 'All your conversations in one place.',
  },
  '/profile': {
    breadcrumbs: [{ label: 'Account', href: '/settings' }, { label: 'Profile' }],
    eyebrow: 'Account',
    title: 'My profile',
  },
  '/settings': {
    breadcrumbs: [{ label: 'Account', href: '/settings' }, { label: 'Settings' }],
    eyebrow: 'Account',
    title: 'Settings',
    description: 'Manage account, notifications, and discoverability.',
  },
  '/notifications': {
    breadcrumbs: [{ label: 'Account', href: '/home' }, { label: 'Notifications' }],
    eyebrow: 'Workspace',
    title: 'Notifications',
    description: 'Unread messages, applications, and outreach responses.',
  },
}

function matchDynamicMeta(pathname: string, accountType: 'hirer' | 'talent'): PageMeta | null {
  if (accountType === 'hirer') {
    const jobMatch = pathname.match(/^\/my-jobs\/([^/]+)$/)
    if (jobMatch && jobMatch[1] !== 'new') {
      return {
        breadcrumbs: [{ label: 'Jobs', href: '/my-jobs' }, { label: 'Job' }],
        title: 'Job',
      }
    }

    const talentMatch = pathname.match(/^\/talent\/([^/]+)$/)
    if (talentMatch) {
      return {
        breadcrumbs: [{ label: 'Search', href: '/search' }, { label: 'Profile' }],
      }
    }
  }

  if (accountType === 'talent') {
    const discoverMatch = pathname.match(/^\/discover\/([^/]+)$/)
    if (discoverMatch) {
      return {
        breadcrumbs: [{ label: 'Discover', href: '/discover' }, { label: 'Job brief' }],
      }
    }
  }

  const threadMatch = pathname.match(/^\/messages\/([^/]+)$/)
  if (threadMatch) {
    return {
      breadcrumbs: [{ label: 'Messages', href: '/messages' }, { label: 'Conversation' }],
    }
  }

  return null
}

export function getPageMeta(pathname: string, accountType: 'hirer' | 'talent'): PageMeta {
  const staticMap = accountType === 'hirer' ? HIRER_STATIC : TALENT_STATIC
  if (staticMap[pathname]) return staticMap[pathname]

  const dynamic = matchDynamicMeta(pathname, accountType)
  if (dynamic) return dynamic

  const label = pathname.split('/').filter(Boolean).pop() ?? 'Atlas'
  return {
    breadcrumbs: [{ label: label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, ' ') }],
  }
}

export function getSearchTarget(accountType: 'hirer' | 'talent'): string {
  return accountType === 'hirer' ? '/search' : '/discover'
}
