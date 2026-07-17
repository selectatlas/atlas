// Structured system cards in message threads. Messages carry a `kind`
// (default 'text'); non-text kinds mark thread events - application
// received, outreach sent, shortlisted, hired - and render as inline
// cards instead of chat bubbles. Emission points are the application,
// outreach and application-status API routes.

export const SYSTEM_MESSAGE_KINDS = [
  'application_received',
  'outreach_sent',
  'application_shortlisted',
  'application_hired',
  'application_declined',
  'review_published',
  'job_closed',
] as const

export type SystemMessageKind = (typeof SYSTEM_MESSAGE_KINDS)[number]
export type MessageKind = 'text' | SystemMessageKind

export function isSystemMessageKind(kind: string | null | undefined): kind is SystemMessageKind {
  return (SYSTEM_MESSAGE_KINDS as readonly string[]).includes(kind ?? '')
}

// Short card heading rendered above the message content.
export function systemCardTitle(kind: SystemMessageKind): string {
  switch (kind) {
    case 'application_received':
      return 'Application received'
    case 'outreach_sent':
      return 'Outreach sent'
    case 'application_shortlisted':
      return 'Shortlisted'
    case 'application_hired':
      return 'Hired'
    case 'application_declined':
      return 'Not selected'
    case 'review_published':
      return 'Review published'
    case 'job_closed':
      return 'Role closed'
  }
}

// Human-readable body stored as the message content, so older clients
// and inbox previews degrade to a sensible sentence.
export function buildSystemMessageContent(
  kind: SystemMessageKind,
  context: { jobTitle?: string | null } = {},
): string {
  const jobTitle = context.jobTitle?.trim()
  switch (kind) {
    case 'application_received':
      return jobTitle ? `Applied to ${jobTitle}` : 'Submitted an application'
    case 'outreach_sent':
      return jobTitle ? `Reached out about ${jobTitle}` : 'Reached out to start a conversation'
    case 'application_shortlisted':
      return jobTitle ? `Shortlisted for ${jobTitle}` : 'Application shortlisted'
    case 'application_hired':
      return jobTitle ? `Hired for ${jobTitle}` : 'Hired for this role'
    case 'application_declined':
      return jobTitle
        ? `The role ${jobTitle} went in a different direction this time`
        : 'This role went in a different direction this time'
    case 'review_published':
      return jobTitle ? `Left a review after ${jobTitle}` : 'Left a review on your profile'
    case 'job_closed':
      return jobTitle ? `${jobTitle} is no longer accepting applications` : 'This role has closed'
  }
}
