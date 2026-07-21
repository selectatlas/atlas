import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GUIDES } from '@/lib/guides'

export const metadata: Metadata = {
  title: 'Guides',
  description: 'Short guides on photos, profile slots, and getting found more often on Atlas.',
}

export default function GuidesPage() {
  return (
    <div className="space-y-8 py-2">
      <PageShell
        eyebrow="Knowledge centre"
        title="Guides"
        description="Short, practical guides to help your profile do its best work."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map(guide => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Card className="h-full border border-border/80 shadow-none transition-colors group-hover:border-primary/40 group-hover:bg-primary/5">
              <CardHeader>
                <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="size-4" />
                </span>
                <CardTitle>{guide.title}</CardTitle>
                <CardDescription>{guide.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  Read guide
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
