'use client'

import { Navbar } from './Navbar'

const links = [
  { href: '/home', label: 'Home' },
  { href: '/search', label: 'Search' },
  { href: '/shortlists', label: 'Saved' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/messages', label: 'Messages' },
  { href: '/outreach', label: 'Outreach' },
]

const bottomLinks = [
  { href: '/settings', label: 'Settings' },
  { href: '/profile', label: 'Profile' },
]

export function HirerNav() {
  return <Navbar links={links} bottomLinks={bottomLinks} primaryAction={{ href: '/jobs/new', label: 'Post a job' }} />
}
