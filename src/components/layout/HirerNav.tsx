'use client'

import { Navbar } from './Navbar'

const links = [
  { href: '/search', label: 'Search' },
  { href: '/activity', label: 'Activity' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/messages', label: 'Messages' },
  { href: '/outreach', label: 'Outreach' },
]

export function HirerNav() {
  return <Navbar links={links} primaryAction={{ href: '/jobs/new', label: 'Post a job' }} />
}
