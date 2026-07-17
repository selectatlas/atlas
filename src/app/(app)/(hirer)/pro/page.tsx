import type { Metadata } from 'next'
import { BadgeCheck, BellRing, Check, Crown, Headset } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ComingSoonButton } from '@/components/monetization/ComingSoonButton'

export const metadata: Metadata = {
  title: 'Atlas Pro',
  description: 'Vetted talent access, saved-search alerts, and priority support for hiring teams.',
}

const STANDARD_FEATURES = [
  'AI talent search with real match scores',
  'Shortlists, likes, and talent profiles',
  'Job posts and applications',
  'Direct messaging and outreach',
]

const PRO_FEATURES = [
  {
    icon: BadgeCheck,
    title: 'Vetted talent access',
    description: 'Filter every search to Atlas Verified and Top Rated talent only.',
  },
  {
    icon: BellRing,
    title: 'Saved-search alerts',
    description: 'Atlas keeps scouting your briefs and tells you when new matches land.',
  },
  {
    icon: Headset,
    title: 'Priority support',
    description: 'Same-day help from the Atlas team, from brief to booking.',
  },
]

function FeatureRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  )
}

export default function AtlasProPage() {
  return (
    <div className="space-y-8 py-2">
      <PageShell
        eyebrow="Plans"
        title="Atlas Pro"
        description="Hire with an edge - vetted talent, alerts that keep scouting, and a team on call."
      />

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card className="border border-border/80 p-5 shadow-none">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Standard</p>
            <Badge variant="outline">Current plan</Badge>
          </div>
          <p className="mt-3 text-2xl font-bold">
            Free
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">forever</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Everything you need to search, shortlist, and hire.
          </p>
          <ul className="mt-5 space-y-3">
            {STANDARD_FEATURES.map(feature => (
              <FeatureRow key={feature}>{feature}</FeatureRow>
            ))}
          </ul>
          <Button variant="outline" className="mt-6 w-full" disabled>
            Your current plan
          </Button>
        </Card>

        <Card className="border border-primary/25 bg-primary/5 p-5 shadow-none">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Crown className="size-4 text-primary" />
              Atlas Pro
            </p>
            <Badge>Coming soon</Badge>
          </div>
          <p className="mt-3 text-2xl font-bold">
            £99
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">per seat / month</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Everything in Standard, plus the tools serious hiring teams run on.
          </p>
          <ul className="mt-5 space-y-4">
            {PRO_FEATURES.map(feature => (
              <li key={feature.title} className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{feature.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <ComingSoonButton
            className="mt-6 w-full"
            description="Atlas Pro is not live yet - we will let you know the moment upgrades open."
          >
            Upgrade to Pro
          </ComingSoonButton>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Pricing shown is illustrative - billing is not enabled in this demo.
      </p>
    </div>
  )
}
