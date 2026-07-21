'use client'

import { Navbar } from './Navbar'
import { useInbox } from './inbox-context'
import { useAppShell } from './app-shell-context'

const links = [
  { href: '/home', label: 'Home' },
  { href: '/discover', label: 'Discover' },
  { href: '/applications', label: 'Applications' },
  { href: '/messages', label: 'Messages' },
]

const adminLinks = [
  { href: '/admin', label: 'Admin' },
]

const bottomLinks = [
  { href: '/settings', label: 'Settings' },
  { href: '/profile', label: 'Profile' },
]

export function TalentNav() {
  const { navBadges } = useInbox()
  const { isPlatformAdmin } = useAppShell()
  return (
    <Navbar
      links={isPlatformAdmin ? [...links, ...adminLinks] : links}
      bottomLinks={bottomLinks}
      badgeCounts={navBadges}
    />
  )
}
