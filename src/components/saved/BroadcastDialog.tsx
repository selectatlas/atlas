'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Megaphone, SendHorizonal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { emitThreadsChanged } from '@/components/messages/types'

// Hirer broadcast: one message fanned out to every shortlisted talent as a
// normal 1:1 conversation (Substack-style announce, WhatsApp-style delivery).
export function BroadcastDialog({ recipientCount }: { recipientCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    const trimmed = content.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/messages/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      if (res.status === 429) {
        setError('You have sent too many broadcasts. Try again in a while.')
        return
      }
      if (!res.ok) throw new Error('broadcast failed')
      const data = (await res.json()) as { sent: number; total: number }
      emitThreadsChanged()
      toast(`Sent to ${data.sent} of ${data.total} shortlisted talent`)
      setOpen(false)
      setContent('')
      router.push('/messages')
    } catch {
      setError('Could not send the broadcast. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) setError(null) }}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
        <Megaphone className="size-4" />
        Message all ({recipientCount})
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Message your shortlist</DialogTitle>
          <DialogDescription className="text-xs">
            Sends one message to all {recipientCount} shortlisted{' '}
            {recipientCount === 1 ? 'person' : 'people'} as individual conversations.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="e.g. We're casting for a new campaign next month - are you available?"
          maxLength={5000}
          rows={4}
          className="resize-none"
          aria-label="Broadcast message"
          autoFocus
        />

        <Button
          onClick={() => void handleSend()}
          disabled={!content.trim() || sending}
          className="w-full gap-2"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
          Send to {recipientCount} {recipientCount === 1 ? 'person' : 'people'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
