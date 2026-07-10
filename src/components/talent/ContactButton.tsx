'use client'

import { useState } from 'react'
import { OutreachModal } from '@/components/outreach/OutreachModal'
import { Button } from '@/components/ui/button'
import type { Profile, TalentSkill } from '@/types'

interface ContactButtonProps {
  talent: Profile & { talent_skills: TalentSkill[] }
}

export function ContactButton({ talent }: ContactButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="fixed inset-x-0 bottom-16 z-30 px-4 pb-2 md:bottom-5 md:pb-0">
        <div className="mx-auto flex max-w-[520px] items-center justify-between gap-4 rounded-xl border border-primary/20 bg-card/95 p-3.5 shadow-lg backdrop-blur-md">
          <div>
            <p className="text-sm font-semibold">Contact {talent.full_name.split(' ')[0]}</p>
            <p className="text-muted-foreground text-xs">AI-drafted outreach message</p>
          </div>
          <Button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Contact
          </Button>
        </div>
      </div>

      <OutreachModal
        talent={open ? talent : null}
        onClose={() => setOpen(false)}
        onSent={() => setOpen(false)}
      />
    </>
  )
}
