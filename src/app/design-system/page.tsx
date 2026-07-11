import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import {
  ArrowUpRight,
  Check,
  Copy,
  Heart,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

export const metadata: Metadata = {
  title: 'castd.ai design system',
  description: 'The Castd product design system and shadcn component reference.',
}

const colorTokens = [
  { name: 'primary', value: '#6046D8', className: 'bg-primary', on: 'on-primary', foreground: 'text-primary-foreground' },
  { name: 'brand-lime', value: '#DFFF62', className: 'bg-brand-lime', on: 'on-lime', foreground: 'text-black' },
  { name: 'brand-lavender', value: '#CFA6E8', className: 'bg-brand-lavender', on: 'on-lavender', foreground: 'text-[#252338]' },
  { name: 'secondary', value: '#EEEAFB', className: 'bg-secondary', on: 'on-secondary', foreground: 'text-secondary-foreground' },
  { name: 'success', value: '#167A52', className: 'bg-success', on: 'on-success', foreground: 'text-success-foreground' },
  { name: 'warning', value: '#A96108', className: 'bg-warning', on: 'on-warning', foreground: 'text-warning-foreground' },
  { name: 'info', value: '#3566C8', className: 'bg-info', on: 'on-info', foreground: 'text-info-foreground' },
  { name: 'destructive', value: '#C93449', className: 'bg-destructive', on: 'on-destructive', foreground: 'text-destructive-foreground' },
]

const typeTokens = [
  { name: 'display', className: 'text-4xl font-semibold tracking-[-0.04em]', spec: '36px / 1.08 / 600' },
  { name: 'heading-1', className: 'text-3xl font-semibold tracking-[-0.035em]', spec: '30px / 1.15 / 600' },
  { name: 'heading-2', className: 'text-xl font-semibold tracking-[-0.02em]', spec: '20px / 1.25 / 600' },
  { name: 'heading-3', className: 'text-base font-semibold', spec: '16px / 1.4 / 600' },
  { name: 'body', className: 'text-sm leading-6', spec: '14px / 1.7 / 400' },
  { name: 'label', className: 'text-xs font-medium', spec: '12px / 1.4 / 500' },
  { name: 'mono', className: 'font-mono text-xs', spec: '12px / 1.5 / 400' },
]

const spacingTokens = [
  ['1', '4px'],
  ['2', '8px'],
  ['3', '12px'],
  ['4', '16px'],
  ['5', '20px'],
  ['6', '24px'],
  ['8', '32px'],
  ['10', '40px'],
  ['12', '48px'],
  ['16', '64px'],
]

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="scroll-mt-6 border-t border-border pt-8" aria-labelledby={`${eyebrow}-title`}>
      <div className="mb-6 max-w-2xl">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h2 id={`${eyebrow}-title`} className="text-2xl font-semibold tracking-[-0.03em]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto max-w-[1280px]">
        <header className="mb-14 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">c</span>
              <span className="text-sm font-semibold tracking-tight">castd.ai</span>
              <Badge variant="secondary">Design system</Badge>
            </div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Build with intent</p>
            <h1 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">A calm, quick-scanning system for finding the right person.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Castd uses shadcn components as its interaction layer, then adds a focused visual language for creative talent discovery: expressive accents, quiet surfaces, and enough density to keep the work moving.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" render={<a href="#components" />}>
              View components
              <ArrowUpRight />
            </Button>
            <Button render={<a href="#colors" />}>
              View tokens
              <Copy />
            </Button>
          </div>
        </header>

        <div className="grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav className="sticky top-8 space-y-1 text-sm" aria-label="Design system sections">
              {['Principles', 'Colors', 'Typography', 'Spacing & shape', 'Components', 'Usage rules'].map((item, index) => (
                <a key={item} href={`#${item.toLowerCase().replaceAll(' ', '-')}`} className={`block rounded-lg px-3 py-2 transition-colors hover:bg-muted hover:text-foreground ${index === 0 ? 'bg-secondary font-medium text-secondary-foreground' : 'text-muted-foreground'}`}>
                  {item}
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 space-y-16">
            <div id="principles">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['01', 'Make intent obvious', 'Primary actions are indigo, match moments are lime, and secondary actions stay quiet.'],
                  ['02', 'Keep the scan light', 'Compact type, predictable spacing, and hairline borders make dense work feel effortless.'],
                  ['03', 'Leave room for people', 'Lavender surfaces and warm accents give a human edge to a data-rich workflow.'],
                ].map(([number, title, copy]) => (
                  <Card key={number} className="border-border/80 shadow-none">
                    <CardHeader>
                      <span className="font-mono text-xs text-muted-foreground">{number}</span>
                      <CardTitle className="mt-2">{title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm leading-6 text-muted-foreground">{copy}</CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div id="colors">
              <Section eyebrow="Colors" title="Expressive accents, quiet foundations" description="Use semantic tokens in UI code. The indigo action colour carries navigation and conversion; lime is intentionally scarce so it keeps its meaning as a match signal.">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {colorTokens.map((token) => (
                    <Card key={token.name} className="overflow-hidden border-border/80 py-0 shadow-none">
                      <div className={`flex h-24 items-end p-3 ${token.className}`}>
                        <span className={`rounded-md bg-black/10 px-2 py-1 text-xs font-medium ${token.foreground}`}>Aa · {token.on}</span>
                      </div>
                      <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="font-mono text-xs">{token.name}</span>
                        <span className="text-xs text-muted-foreground">{token.value}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </Section>
            </div>

            <div id="typography">
              <Section eyebrow="Typography" title="Direct, compact, readable" description="A system sans keeps the product neutral and fast. Weight and spacing carry hierarchy so the interface can stay visually quiet without becoming flat.">
                <Card className="border-border/80 shadow-none">
                  <CardContent className="divide-y divide-border p-0">
                    {typeTokens.map((token) => (
                      <div key={token.name} className="grid gap-3 px-5 py-5 sm:grid-cols-[120px_minmax(0,1fr)_160px] sm:items-center">
                        <span className="font-mono text-xs text-muted-foreground">{token.name}</span>
                        <span className={token.className}>Castd finds the fit.</span>
                        <span className="font-mono text-xs text-muted-foreground sm:text-right">{token.spec}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </Section>
            </div>

            <div id="spacing-&-shape">
              <Section eyebrow="Spacing & shape" title="A reliable rhythm" description="The spacing scale is built on a 4px base. Cards use 12px corners, controls use 8px, and tags use full rounding so each shape has a job.">
                <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
                  <Card className="border-border/80 shadow-none">
                    <CardHeader>
                      <CardTitle>Spacing scale</CardTitle>
                      <CardDescription>Use the smallest step that creates a clear grouping.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {spacingTokens.map(([step, value]) => (
                        <div key={step} className="flex items-center gap-3">
                          <span className="w-8 font-mono text-xs text-muted-foreground">{step}</span>
                          <div className="h-3 rounded-r-full bg-primary/80" style={{ width: `var(--ds-space-${step})` }} />
                          <span className="font-mono text-xs text-muted-foreground">{value}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card className="border-border/80 shadow-none">
                    <CardHeader>
                      <CardTitle>Corner language</CardTitle>
                      <CardDescription>Soft enough to feel human, restrained enough to scan.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        ['xs', 'rounded-[var(--ds-radius-xs)]'],
                        ['sm', 'rounded-[var(--ds-radius-sm)]'],
                        ['md', 'rounded-[var(--ds-radius-md)]'],
                        ['lg', 'rounded-[var(--ds-radius-lg)]'],
                        ['full', 'rounded-full'],
                      ].map(([name, className]) => (
                        <div key={name} className="flex items-center gap-3">
                          <div className={`h-8 flex-1 border border-primary/25 bg-secondary ${className}`} />
                          <span className="w-10 font-mono text-xs text-muted-foreground">{name}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </Section>
            </div>

            <div id="components">
              <Section eyebrow="Components" title="Shadcn primitives, castd defaults" description="These examples are the contract for the reusable UI layer in src/components/ui. Prefer a primitive and a semantic variant over one-off markup.">
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="border-border/80 shadow-none">
                    <CardHeader>
                      <CardTitle>Buttons</CardTitle>
                      <CardDescription>Indigo converts, outline supports, ghost navigates.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button>Primary action</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="outline">Outline</Button>
                      <Button variant="ghost">Ghost</Button>
                      <Button variant="destructive">Destructive</Button>
                      <Button size="icon" aria-label="Search"><Search /></Button>
                      <Button size="icon" variant="outline" aria-label="Save"><Heart /></Button>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80 shadow-none">
                    <CardHeader>
                      <CardTitle>Badges & status</CardTitle>
                      <CardDescription>Tags are short, scannable, and never used as body copy.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-2">
                      <Badge>Top match</Badge>
                      <Badge variant="secondary">Available now</Badge>
                      <Badge variant="outline">London</Badge>
                      <Badge className="bg-brand-lime text-black hover:bg-brand-lime/90">92% match</Badge>
                      <Badge className="bg-success text-success-foreground hover:bg-success/90"><Check /> Shortlisted</Badge>
                      <Badge variant="destructive"><X /> Needs review</Badge>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80 shadow-none">
                    <CardHeader>
                      <CardTitle>Fields</CardTitle>
                      <CardDescription>Labels sit above controls; helper text explains the next action.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="system-search" className="text-xs font-medium">Search talent</label>
                        <Input id="system-search" placeholder="Try “commercial dancer in London”" />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="system-notes" className="text-xs font-medium">Notes</label>
                        <Textarea id="system-notes" placeholder="Add context for the hiring team" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80 shadow-none">
                    <CardHeader>
                      <CardTitle>Talent card</CardTitle>
                      <CardDescription>Identity first, evidence second, action always visible.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl border border-border/80 bg-background p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Avatar size="lg">
                              <AvatarImage src="/branding-1.jpg" alt="Example talent" />
                              <AvatarFallback>ML</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold">Maya Lewis</p>
                              <p className="text-sm text-muted-foreground">Contemporary · London</p>
                            </div>
                          </div>
                          <Badge className="bg-brand-lime text-black hover:bg-brand-lime/90">94%</Badge>
                        </div>
                        <Separator className="my-4" />
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline">Aerial</Badge>
                            <Badge variant="outline">Floorwork</Badge>
                          </div>
                          <Button size="sm">View profile</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80 shadow-none xl:col-span-2">
                    <CardHeader>
                      <CardTitle>AI moments</CardTitle>
                      <CardDescription>AI should explain its value in the same visual language as the rest of the product.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-4 rounded-xl border border-brand-lavender/60 bg-brand-lavender/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-4" /></span>
                          <div>
                            <p className="font-medium">Search understood</p>
                            <p className="mt-1 text-sm text-muted-foreground">We found 18 profiles matching contemporary, aerial, and London.</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Refine search</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </Section>
            </div>

            <div id="usage-rules">
              <Section eyebrow="Usage rules" title="The system is a guardrail" description="Use the primitives consistently, then make room for product-specific moments only when they carry meaning.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-success/30 bg-success/5 shadow-none">
                    <CardHeader><CardTitle className="text-success">Do</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                      <p>Use semantic colour names such as <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">bg-primary</code> and <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">text-muted-foreground</code>.</p>
                      <p>Reach for a shadcn primitive before creating a bespoke control.</p>
                      <p>Reserve lime for match confidence, recommendations, and other moments worth noticing.</p>
                    </CardContent>
                  </Card>
                  <Card className="border-destructive/30 bg-destructive/5 shadow-none">
                    <CardHeader><CardTitle className="text-destructive">Don&apos;t</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                      <p>Do not introduce a new colour for a one-off card or callout.</p>
                      <p>Do not mix rounded-2xl marketing treatments into compact work surfaces.</p>
                      <p>Do not hide the primary action behind a hover-only interaction.</p>
                    </CardContent>
                  </Card>
                </div>
              </Section>
            </div>

            <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
              Canonical tokens live in <code className="font-mono text-xs text-foreground">docs/design.md</code>. The HTML guide mirrors those values. Components are implemented in <code className="font-mono text-xs text-foreground">src/components/ui</code> and configured through <code className="font-mono text-xs text-foreground">components.json</code>.
            </footer>
          </div>
        </div>
      </div>
    </main>
  )
}
