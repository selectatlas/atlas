'use client'

import { Navbar } from './Navbar'

const links = [
  { href: '/discover', label: 'Discover' },
  { href: '/messages', label: 'Messages' },
  { href: '/activity', label: 'Activity' },
]

const bottomLinks = [
  { href: '/settings', label: 'Settings' },
  { href: '/profile', label: 'Profile' },
]

export function TalentNav() {
  return <Navbar links={links} bottomLinks={bottomLinks} />
}
