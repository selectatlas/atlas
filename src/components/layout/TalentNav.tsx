'use client'

import { Navbar } from './Navbar'

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
  return <Navbar links={links} bottomLinks={bottomLinks} />
}
