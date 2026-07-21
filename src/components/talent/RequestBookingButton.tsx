'use client'

import { Button } from '@/components/ui/button'

// The card's primary action, in the footer where the reference layout puts it.
// It opens the same outreach flow as "Contact" on the profile - Atlas has one
// booking conversation, not two. Rendered only when a handler is passed, so
// server-rendered card grids (e.g. SimilarTalent) simply omit it.
export function RequestBookingButton({
  name,
  onRequest,
}: {
  name: string
  onRequest: () => void
}) {
  return (
    <Button
      size="sm"
      aria-label={`Request a booking with ${name}`}
      onClick={event => {
        // The whole card is a link - the button must not navigate.
        event.preventDefault()
        event.stopPropagation()
        onRequest()
      }}
      className="cursor-pointer font-semibold"
    >
      Request booking
    </Button>
  )
}
