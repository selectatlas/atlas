import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>
}
