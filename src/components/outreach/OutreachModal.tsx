'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isActiveLocalDemoMode } from '@/lib/demo-mode'
import type { Profile, TalentSkill } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface OutreachModalProps {
  talent: (Profile & { talent_skills: TalentSkill[] }) | null
  /** When set, the outreach is an invite to this job: it frames the AI draft and links the resulting thread to the job. */
  job?: { id: string; title: string } | null
  onClose: () => void
  onSent: () => void
}

export function OutreachModal({ talent, job = null, onClose, onSent }: OutreachModalProps) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    if (!talent) return
    /* eslint-disable react-hooks/set-state-in-effect -- reset the composer when the outreach target changes */
    setMessage('')
    setSent(false)
    setError(null)
    /* eslint-enable react-hooks/set-state-in-effect */
    void refreshDemoModeAndGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talent?.id, job?.id])

  async function refreshDemoModeAndGenerate() {
    const demo = await isActiveLocalDemoMode()
    setIsDemo(demo)
    await generateMessage(demo)
  }

  async function generateMessage(demo = isDemo) {
    if (!talent) return
    setGenerating(true)
    setError(null)

    if (demo) {
      const firstName = talent.full_name.split(' ')[0]
      setMessage(
        job
          ? `Hi ${firstName}, your work looks like a strong fit for "${job.title}". I’d love to share the brief and see if you’re available.`
          : `Hi ${firstName}, your work looks like a strong fit for a new creative brief. I’d love to share more about the project and see if you’re available.`,
      )
      setGenerating(false)
      return
    }

    try {
      let hirerContext = 'a casting director looking for creative talent'
      try {
        const settingsRes = await fetch('/api/me/settings')
        if (settingsRes.ok) {
          const settings = await settingsRes.json()
          if (typeof settings.outreach_defaults?.tone_context === 'string' && settings.outreach_defaults.tone_context.trim()) {
            hirerContext = settings.outreach_defaults.tone_context.trim()
          }
        }
      } catch {
        // Fall back to the generic context when settings are unavailable.
      }

      if (job) {
        hirerContext = `${hirerContext}, inviting this talent to apply for their job "${job.title}"`
      }

      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          talent_id: talent.id,
          action: 'generate',
          hirer_context: hirerContext,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? 'Could not generate message')
        return
      }
      const data = await res.json()
      if (data.message) setMessage(data.message)
      else setError('Could not generate message')
    } catch {
      setError('Network error')
    }
    setGenerating(false)
  }

  async function sendMessage() {
    if (!talent || !message.trim()) return
    setSending(true)
    setError(null)

    const demo = await isActiveLocalDemoMode()
    setIsDemo(demo)
    if (demo) {
      setSent(true)
      setSending(false)
      setTimeout(() => { onSent(); onClose() }, 1200)
      return
    }

    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          talent_id: talent.id,
          action: 'send',
          message: message.trim(),
          job_id: job?.id,
        }),
      })
      const data = await res.json() as { success?: boolean; thread_id?: string | null; error?: string }
      if (data.success) {
        setSent(true)
        setTimeout(() => {
          onSent()
          onClose()
          if (data.thread_id) router.push(`/messages/${data.thread_id}`)
        }, 1200)
      } else {
        setError(data.error ?? 'Failed to send')
      }
    } catch {
      setError('Network error')
    }
    setSending(false)
  }

  return (
    <Dialog open={!!talent} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{job ? 'Invite to job' : 'Contact talent'}</DialogTitle>
        </DialogHeader>

        {talent && (
          <div className="space-y-4">
            {/* Talent header */}
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 rounded-xl">
                <AvatarImage src={talent.avatar_url ?? ''} alt={talent.full_name} />
                <AvatarFallback className="rounded-xl text-lg font-bold">
                  {talent.full_name[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{talent.full_name}</p>
                <p className="text-muted-foreground text-xs">
                  {talent.talent_skills.slice(0, 2).map(s => s.skill).join(' · ')}
                </p>
              </div>
            </div>

            {job && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Inviting to <span className="font-medium text-foreground">{job.title}</span>
              </p>
            )}

            <p className="text-muted-foreground text-xs font-medium">AI-generated outreach message</p>

            {/* Message area */}
            {generating ? (
              <div className="bg-muted border rounded-2xl p-4 min-h-[120px] flex items-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-primary rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <span className="text-muted-foreground text-sm">Crafting personalised message...</span>
              </div>
            ) : (
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                className="resize-none rounded-2xl"
                placeholder="Your message..."
              />
            )}

            {error && (
              <p className="text-destructive text-xs">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void generateMessage()}
                disabled={generating || sending}
                className="gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Regenerate
              </Button>

              <Button
                onClick={sendMessage}
                disabled={!message.trim() || generating || sending || sent}
                className="ml-auto bg-accent text-accent-foreground hover:bg-accent/80 rounded-xl font-semibold"
              >
                {sent ? '✓ Sent!' : sending ? 'Sending...' : 'Send message'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
