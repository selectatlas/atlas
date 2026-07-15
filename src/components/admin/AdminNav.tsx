'use client'

import { Navbar } from '@/components/layout/Navbar'
import { AdminViewSwitcher } from '@/components/admin/AdminViewSwitcher'

const links = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/accounts', label: 'Accounts' },
  { href: '/admin/jobs', label: 'Jobs' },
  { href: '/admin/talent', label: 'Add talent' },
  { href: '/search', label: 'Search' },
]

export function AdminNav() {
  return <Navbar links={links} accountSwitcher={<AdminViewSwitcher />} />
}
