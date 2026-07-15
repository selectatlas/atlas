import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>
}
