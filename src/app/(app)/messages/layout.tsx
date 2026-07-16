import { MessagesShell } from '@/components/messages/MessagesShell'

// The conversation list lives here (not in the page) so it stays mounted
// while navigating between threads - only the detail pane re-renders.
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <MessagesShell>{children}</MessagesShell>
}
