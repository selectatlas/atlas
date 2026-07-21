'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Reply, SendHorizonal, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { quotedSnippet } from '@/lib/reactions'
import type { ThreadMessage } from '@/lib/messages-view'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { MessageAssistMode } from '@/lib/openai'

const REWRITE_ACTIONS: Array<{ mode: MessageAssistMode; label: string }> = [
  { mode: 'rephrase', label: 'Rephrase' },
  { mode: 'friendlier', label: 'Friendlier' },
  { mode: 'concise', label: 'More concise' },
]

export function MessageComposer({
  threadId,
  onSend,
  onTyping,
  disabled,
  replyTo,
  replyToName,
  onCancelReply,
}: {
  threadId: string
  onSend: (content: string) => Promise<string | null>
  onTyping: () => void
  disabled?: boolean
  replyTo?: ThreadMessage | null
  replyToName?: string
  onCancelReply?: () => void
}) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [assisting, setAssisting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus()
  }, [replyTo])

  async function handleSend() {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    const sendError = await onSend(content)
    if (sendError) {
      setError(sendError)
    } else {
      setInput('')
    }
    setSending(false)
    textareaRef.current?.focus()
  }

  async function requestAssist(mode: MessageAssistMode) {
    if (assisting) return
    setAssisting(true)
    setError(null)
    try {
      const res = await fetch('/api/messages/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: threadId,
          mode,
          draft: mode === 'draft' ? undefined : input,
        }),
      })
      if (!res.ok) throw new Error('assist failed')
      const data = (await res.json()) as { message?: string }
      if (!data.message) throw new Error('assist failed')
      setInput(data.message)
      textareaRef.current?.focus()
    } catch {
      // The composer must never block on AI: surface a soft hint and move on.
      setError('Writing assistance is unavailable right now')
    } finally {
      setAssisting(false)
    }
  }

  return (
    <div className="shrink-0 border-t border-border/80 bg-background px-4 py-3">
      {error && (
        <p className="mb-2 text-xs text-muted-foreground" role="alert">{error}</p>
      )}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary/60 bg-muted/60 px-3 py-1.5">
          <Reply className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-xs">
            <span className="block font-medium">Replying to {replyToName ?? 'message'}</span>
            <span className="block truncate text-muted-foreground">
              {quotedSnippet(replyTo.content, 90)}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <form
        onSubmit={e => { e.preventDefault(); void handleSend() }}
        className="flex items-end gap-2"
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 rounded-xl"
                disabled={disabled || assisting}
                aria-label="AI writing assistance"
              />
            }
          >
            {assisting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Write with AI</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => void requestAssist('draft')}>
                Suggest a reply
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {REWRITE_ACTIONS.map(action => (
                <DropdownMenuItem
                  key={action.mode}
                  disabled={!input.trim()}
                  onClick={() => void requestAssist(action.mode)}
                >
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => {
            setInput(e.target.value)
            onTyping()
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder="Type a message..."
          maxLength={5000}
          rows={1}
          disabled={disabled}
          className="max-h-36 min-h-10 flex-1 resize-none"
          aria-label="Message"
        />

        <Button
          type="submit"
          disabled={!input.trim() || sending || disabled}
          size="icon"
          className="shrink-0 rounded-xl"
          aria-label="Send message"
        >
          <SendHorizonal className="size-4" />
        </Button>
      </form>
    </div>
  )
}
