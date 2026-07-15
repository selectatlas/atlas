'use client'

import { Navbar } from './Navbar'
import { useInbox } from './inbox-context'

const links = [
  { href: '/home', label: 'Home' },
  { href: '/discover', label: 'Discover' },
  { href: '/messages', label: 'Messages' },
]

const bottomLinks = [
  { href: '/settings', label: 'Settings' },
  { href: '/profile', label: 'Profile' },
]

export function TalentNav() {
  const { navBadges } = useInbox()
  return <Navbar links={links} bottomLinks={bottomLinks} badgeCounts={navBadges} />
}
