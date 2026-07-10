'use client'

import { Navbar } from './Navbar'

const links = [
  { href: '/discover', label: 'Discover' },
  { href: '/profile', label: 'Profile' },
  { href: '/messages', label: 'Messages' },
  { href: '/activity', label: 'Activity' },
]

export function TalentNav() {
  return <Navbar links={links} />
}
