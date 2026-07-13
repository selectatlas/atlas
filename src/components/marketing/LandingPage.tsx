'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import Hero from '@/components/Hero'

const steps: Array<{ number: string; title: string; description: string; icon: LucideIcon }> = [
  {
    number: '01',
    title: 'Write the brief',
    description: 'Describe the person, not a pile of filters. Include the details that actually matter to the project.',
    icon: FileText,
  },
  {
    number: '02',
    title: 'Review the signal',
    description: 'Get a ranked shortlist with the skills, location, and availability that make each match relevant.',
    icon: Sparkles,
  },
  {
    number: '03',
    title: 'Make the first move',
    description: 'Open a profile, shortlist the right people, and send a considered message while the brief is fresh.',
    icon: Users,
  },
]

export function LandingPage() {
  return (
    <main className="landing-page" aria-label="Atlas landing page">
      <header className="landing-header">
        <div className="landing-header__inner">
          <Link href="/" className="landing-brand" aria-label="Atlas home">
            <span>atlas</span><b>.ai</b>
          </Link>

          <nav className="landing-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#for-hirers">For hirers</a>
            <a href="#for-talent">For talent</a>
          </nav>

          <div className="landing-header__actions">
            <Link href="/login" className="landing-header__login">Sign in</Link>
            <Link href="/signup" className="landing-button landing-button--small landing-button--dark">
              Try Atlas
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <Hero />

      <section className="landing-signal-strip" aria-label="Who Atlas is for">
        <span>For casting directors</span><i aria-hidden="true" />
        <span>For producers</span><i aria-hidden="true" />
        <span>For creative teams</span>
      </section>

      <section className="landing-section landing-section--soft" id="how-it-works">
        <div className="landing-section__heading">
          <p className="landing-eyebrow">How it works</p>
          <h2>Less scrolling. More signal.</h2>
          <p>Atlas makes the first pass feel like a conversation with someone who understands the brief.</p>
        </div>

        <div className="landing-steps">
          {steps.map(step => {
            const Icon = step.icon
            return (
              <article className="landing-step" key={step.number}>
                <div className="landing-step__topline"><span>{step.number}</span><Icon aria-hidden="true" /></div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="landing-section landing-section--audiences" aria-label="Atlas for hirers and talent">
        <article className="landing-audience landing-audience--hirers" id="for-hirers">
          <div className="landing-audience__copy">
            <p className="landing-audience__label">For hirers</p>
            <h2>Stop searching titles. Search for the actual person behind the brief.</h2>
            <p>From niche movement skills to a specific on-camera presence, Atlas lets you ask for the combination that matters.</p>
            <ul>
              <li><Check aria-hidden="true" />Ranked matches with a reason for every result</li>
              <li><Check aria-hidden="true" />Natural-language search plus familiar filters</li>
              <li><Check aria-hidden="true" />Shortlist and reach out in one focused flow</li>
            </ul>
            <Link href="/signup" className="landing-text-link">Start a search <ArrowRight aria-hidden="true" /></Link>
          </div>
          <div className="landing-audience__visual" aria-hidden="true">
            <div className="landing-mini-window">
              <div className="landing-mini-window__header"><span>Brief</span><span>3 strong matches</span></div>
              <div className="landing-mini-brief"><span className="landing-mini-brief__icon"><Search /></span><span>Hindi-speaking performer<br /><b>in London · available December</b></span></div>
              <div className="landing-mini-row"><span className="landing-mini-avatar landing-result__avatar--lime">PS</span><span><b>Priya Singh</b><small>98% match · Bollywood</small></span><strong>98%</strong></div>
              <div className="landing-mini-row"><span className="landing-mini-avatar landing-result__avatar--lavender">AK</span><span><b>Aisha Khan</b><small>94% match · Bhangra</small></span><strong>94%</strong></div>
              <div className="landing-mini-row"><span className="landing-mini-avatar landing-result__avatar--indigo">RM</span><span><b>Ravi Mehta</b><small>89% match · Movement</small></span><strong>89%</strong></div>
            </div>
          </div>
        </article>

        <article className="landing-audience landing-audience--talent" id="for-talent">
          <div className="landing-audience__visual" aria-hidden="true">
            <div className="landing-profile-card">
              <div className="landing-profile-card__top"><span className="landing-mini-avatar landing-result__avatar--lavender">NO</span><span className="landing-profile-card__status"><i />Profile discoverable</span></div>
              <div className="landing-profile-card__name"><b>Nia Okafor</b><span>Creator · Director · Host</span></div>
              <div className="landing-profile-card__tags"><span>Lifestyle</span><span>Short-form video</span><span>On-camera</span></div>
              <div className="landing-profile-card__meter"><span><b>Profile strength</b><b>86%</b></span><i><em /></i></div>
              <div className="landing-profile-card__footer"><span>3 relevant briefs this week</span><ArrowUpRight /></div>
            </div>
          </div>
          <div className="landing-audience__copy">
            <p className="landing-audience__label">For talent</p>
            <h2>Be found for what you actually do.</h2>
            <p>Show the skills, credits, and working style that make you a fit. Your profile becomes more than a list of titles.</p>
            <ul>
              <li><Check aria-hidden="true" />Lead with the skills that set you apart</li>
              <li><Check aria-hidden="true" />Make relevant opportunities easier to find</li>
              <li><Check aria-hidden="true" />Keep your work and availability in one place</li>
            </ul>
            <Link href="/signup" className="landing-text-link">Create your profile <ArrowRight aria-hidden="true" /></Link>
          </div>
        </article>
      </section>

      <section className="landing-final-cta">
        <div>
          <h2>Find the people your project needs.</h2>
          <p>Start with a plain-language search and see where it takes you.</p>
        </div>
        <div className="landing-final-cta__actions">
          <Link href="/signup" className="landing-button landing-button--light">Start finding talent <ArrowUpRight aria-hidden="true" /></Link>
          <Link href="/login" className="landing-button landing-button--outline-light">Sign in <ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer__brand"><Link href="/" className="landing-brand"><span>atlas</span><b>.ai</b></Link><p>AI-native talent discovery for the creative industry.</p></div>
        <div className="landing-footer__links"><Link href="/login">Sign in</Link><Link href="/signup">Create account</Link><a href="#top">Back to top <ArrowUpRight aria-hidden="true" /></a></div>
        <p className="landing-footer__copyright">© 2026 Atlas</p>
      </footer>
    </main>
  )
}
