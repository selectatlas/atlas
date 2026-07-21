import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, Dot, X } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Card } from '@/components/ui/card'
import { GUIDES, getGuide, type GuideSection } from '@/lib/guides'

type GuidePageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return GUIDES.map(guide => ({ slug: guide.slug }))
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuide(slug)
  if (!guide) return { title: 'Guide not found' }
  return { title: guide.title, description: guide.description }
}

function GuideSectionBlock({ section }: { section: GuideSection }) {
  return (
    <section className="space-y-3">
      {section.heading && <h2 className="text-base font-semibold">{section.heading}</h2>}
      {section.paragraphs?.map(paragraph => (
        <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">{paragraph}</p>
      ))}
      {section.bullets && (
        <ul className="space-y-2">
          {section.bullets.map(bullet => (
            <li key={bullet} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
              <Dot className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
      {section.doDont && (
        <ul className="space-y-2">
          {section.doDont.map(item => (
            <li key={item.text} className="flex items-start gap-2.5 text-sm leading-relaxed">
              {item.kind === 'do' ? (
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="size-3" />
                </span>
              ) : (
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                  <X className="size-3" />
                </span>
              )}
              <span className="text-muted-foreground">{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function GuideDetailPage({ params }: GuidePageProps) {
  const { slug } = await params
  const guide = getGuide(slug)
  if (!guide) notFound()

  return (
    <div className="space-y-6 py-2">
      <PageShell eyebrow="Knowledge centre" title={guide.title} description={guide.description} />

      <div className="max-w-2xl space-y-6">
        <Link
          href="/guides"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All guides
        </Link>

        <Card className="border border-border/80 p-5 shadow-none sm:p-6">
          <div className="space-y-6">
            {guide.sections.map((section, index) => (
              <GuideSectionBlock key={section.heading ?? `section-${index}`} section={section} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
