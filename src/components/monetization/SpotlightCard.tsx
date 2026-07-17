import { Sparkles, Zap } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ComingSoonButton } from '@/components/monetization/ComingSoonButton'
import {
  SPOTLIGHT_DURATION_DAYS,
  SPOTLIGHT_PRICE_LABEL,
  formatSpotlightCountdown,
  getMockSpotlightActivation,
  getSpotlightStatus,
} from '@/lib/spotlight'

/**
 * Talent-side Spotlight upsell - mockup-grade, no billing.
 * Shows the pitch plus a mocked preview of the active countdown state.
 */
export function SpotlightCard() {
  const preview = getSpotlightStatus(getMockSpotlightActivation())

  return (
    <Card className="border border-primary/20 bg-primary/5 p-5 shadow-none">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Zap className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Spotlight</p>
            <Badge variant="secondary">Boost</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Get seen first - Spotlight pins your profile to the top of matching searches for{' '}
            {SPOTLIGHT_DURATION_DAYS} days, so hirers meet you before anyone else.
          </p>
        </div>
      </div>

      {preview.active && (
        <div className="mt-4 rounded-xl border border-primary/15 bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <Sparkles className="size-3.5 text-primary" />
              Spotlight active
            </p>
            <span className="text-xs font-semibold text-primary">
              {formatSpotlightCountdown(preview)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${preview.percentRemaining}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Preview - this is how your boost will look while it runs.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ComingSoonButton description="Spotlight checkout is not live yet - it is on the roadmap.">
          Boost my profile - {SPOTLIGHT_PRICE_LABEL}
        </ComingSoonButton>
        <p className="text-xs text-muted-foreground">One-off boost - no subscription.</p>
      </div>
    </Card>
  )
}
