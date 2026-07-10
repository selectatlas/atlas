'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
}

interface OtherUser {
  full_name: string
  avatar_url: string | null
}

export default function ThreadPage() {
  const params = useParams()
  const router = useRouter()
  const threadId = params.id as string

  const [messages, setMessages] = useState<Message[]>([])
  const [other, setOther] = useState<OtherUser | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages/threads/${threadId}`)
      if (!res.ok) { router.push('/messages'); return }
      const data = await res.json()
      setOther(data.other)
      setMessages(data.messages ?? [])
    } catch {
      router.push('/messages')
    }
    setLoading(false)
  }, [threadId, router])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
      loadMessages()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => [...prev, newMsg])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [threadId, userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)
    try {
      await fetch(`/api/messages/threads/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input.trim() }),
      })
      setInput('')
    } catch { /* ignore */ }
    setSending(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen-safe">
        <div className="h-14 bg-background border-b flex items-center px-4">
          <div className="w-24 h-4 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex-1" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-background border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.push('/messages')}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Button>

        {other && (
          <>
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={other.avatar_url ?? ''} alt={other.full_name} />
              <AvatarFallback className="rounded-lg text-sm font-bold">
                {other.full_name[0]}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold text-sm">{other.full_name}</span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">No messages yet. Say hello.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMine = msg.sender_id === userId
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-xs mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="shrink-0 px-4 py-3 bg-background border-t flex gap-2">
        <Input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={!input.trim() || sending}
          size="icon"
          className="shrink-0 rounded-xl"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          </svg>
        </Button>
      </form>
    </div>
  )
}
