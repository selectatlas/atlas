'use client'

import { Navbar } from './Navbar'
import { useInbox } from './inbox-context'
import { useAppShell } from './app-shell-context'

const links = [
  { href: '/home', label: 'Home' },
  { href: '/search', label: 'Search' },
  { href: '/shortlists', label: 'Saved' },
  { href: '/my-jobs', label: 'Jobs' },
  { href: '/messages', label: 'Messages' },
  { href: '/outreach', label: 'Outreach' },
]

const adminLinks = [
  { href: '/admin', label: 'Admin' },
  { href: '/admin/talent', label: 'Add talent' },
]

const bottomLinks = [
  { href: '/settings', label: 'Settings' },
  { href: '/profile', label: 'Profile' },
]

export function HirerNav() {
  const { navBadges } = useInbox()
  const { isPlatformAdmin } = useAppShell()
  return (
    <Navbar
      links={isPlatformAdmin ? [...links, ...adminLinks] : links}
      bottomLinks={bottomLinks}
      primaryAction={{ href: '/my-jobs/new', label: 'Post a job' }}
      badgeCounts={navBadges}
    />
  )
}
