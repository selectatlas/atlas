import { MessageSquare } from 'lucide-react'

// Desktop-only empty pane: on mobile the conversation list fills the screen
// at /messages, so this pane is hidden by the shell.
export default function MessagesPage() {
  return (
    <div className="hidden h-full flex-col items-center justify-center px-6 text-center md:flex">
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <MessageSquare className="size-5" />
      </div>
      <p className="font-medium">Select a conversation</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Choose a conversation from the list, or start one from search, outreach, or a talent profile.
      </p>
    </div>
  )
}
