'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  FileText,
  MapPin,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react'
import Hero from '@/components/Hero'

const briefExamples: Array<{
  category: string
  brief: string
  visual: 'search' | 'casting' | 'campaign' | 'availability' | 'photo_video'
}> = [
  {
    category: 'Commercial casting',
    brief: 'Find a bilingual presenter in London with travel availability in December.',
    visual: 'search',
  },
  {
    category: 'Film & TV',
    brief: 'Sixties-look supporting cast who can actually ride horses.',
    visual: 'casting',
  },
  {
    category: 'Creator campaigns',
    brief: 'Lifestyle creators with strong on-camera hosting and an engaged audience.',
    visual: 'campaign',
  },
  {
    category: 'Events & live performance',
    brief: 'A Bhangra troupe available for a two-night corporate show in Manchester.',
    visual: 'availability',
  },
  {
    category: 'Photography & video',
    brief: 'A photographer-videographer with music-video credits available for a three-day shoot next month.',
    visual: 'photo_video',
  },
]

const steps: Array<{ number: string; title: string; description: string; image: string; icon: LucideIcon }> = [
  {
    number: '01',
    title: 'Write the brief',
    description: 'Describe the person, not a pile of filters. Include the details that actually matter to the project.',
    image: '/landing/brief-writing-workspace.jpg',
    icon: FileText,
  },
  {
    number: '02',
    title: 'Review the signal',
    description: 'Get a ranked shortlist with the skills, location, and availability that make each match relevant.',
    image: '/landing/signal-review-match.jpg',
    icon: Sparkles,
  },
  {
    number: '03',
    title: 'Make the first move',
    description: 'Open a profile, shortlist the right people, and send a considered message while the brief is fresh.',
    image: '/landing/first-move-connection.jpg',
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
                <div className="landing-step__image">
                  <Image src={step.image} alt="" fill sizes="(max-width: 780px) 100vw, 33vw" />
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="landing-section" id="product" aria-label="What Atlas does">
        <div className="landing-section__heading">
          <p className="landing-eyebrow">The product</p>
          <h2>A better brief produces a better shortlist.</h2>
          <p>Atlas turns the details people usually lose in a spreadsheet into a ranked, explainable next step.</p>
        </div>

        <div className="landing-bento">
          <article className="landing-bento__cell landing-bento__cell--wide landing-bento__cell--ink">
            <div className="landing-bento__copy">
              <h3>Search like you brief</h3>
              <p>Ask for the combination that matters — not the closest job title.</p>
            </div>
            <div className="landing-bento__visual" aria-hidden="true">
              <div className="landing-bento-search">
                <div className="landing-bento-search__input">
                  <Search aria-hidden="true" />
                  <span>Hindi-speaking dancer in London, available this December</span>
                </div>
                <div className="landing-bento-search__chips">
                  <span>Hindi speaker</span>
                  <span>Dance · Bollywood</span>
                  <span>London</span>
                  <span>Dec availability</span>
                </div>
                <div className="landing-bento-search__results">
                  <span className="landing-mini-avatar"><Image src="/hero/01.jpg" alt="" fill sizes="32px" /></span>
                  <span className="landing-mini-avatar"><Image src="/hero/12.jpg" alt="" fill sizes="32px" /></span>
                  <span className="landing-mini-avatar"><Image src="/hero/02.jpg" alt="" fill sizes="32px" /></span>
                  <b>3 strong matches</b>
                </div>
              </div>
            </div>
          </article>

          <article className="landing-bento__cell">
            <div className="landing-bento__copy">
              <h3>Why this match</h3>
              <p>Every strong result comes with receipts.</p>
            </div>
            <div className="landing-bento__visual" aria-hidden="true">
              <div className="landing-bento-match">
                <div className="landing-bento-match__person">
                  <span className="landing-mini-avatar"><Image src="/hero/01.jpg" alt="" fill sizes="32px" /></span>
                  <span><b>Priya Singh</b><small>Example match score</small></span>
                </div>
                <div className="landing-bento-match__reasons">
                  <span><Check aria-hidden="true" />Hindi speaker</span>
                  <span><Check aria-hidden="true" />Based in London</span>
                  <span><Check aria-hidden="true" />Available in December</span>
                  <span><Check aria-hidden="true" />Bollywood trained</span>
                </div>
              </div>
            </div>
          </article>

          <article className="landing-bento__cell">
            <div className="landing-bento__copy">
              <h3>Availability in context</h3>
              <p>See who can actually make the date.</p>
            </div>
            <div className="landing-bento__visual" aria-hidden="true">
              <p className="landing-bento-availability__label text-xs uppercase tracking-wide text-muted-foreground">Example UI</p>
              <div className="landing-bento-availability">
                <span className="landing-bento-availability__label">Availability</span>
                <p className="text-sm">Available December · London · Travel on request</p>
                <small>Shown from each talent&apos;s profile availability field</small>
              </div>
            </div>
          </article>

          <article className="landing-bento__cell landing-bento__cell--wide">
            <div className="landing-bento__copy">
              <h3>Shortlist without the handoff</h3>
              <p>Move from discovery to a considered first message in one flow.</p>
            </div>
            <div className="landing-bento__visual" aria-hidden="true">
              <div className="landing-bento-flow">
                <div className="landing-bento-flow__stage">
                  <span>Discover</span>
                  <div className="landing-bento-flow__faces">
                    <span className="landing-mini-avatar"><Image src="/hero/03.jpg" alt="" fill sizes="32px" /></span>
                    <span className="landing-mini-avatar"><Image src="/hero/07.jpg" alt="" fill sizes="32px" /></span>
                    <span className="landing-mini-avatar"><Image src="/hero/09.jpg" alt="" fill sizes="32px" /></span>
                    <span className="landing-mini-avatar"><Image src="/hero/11.jpg" alt="" fill sizes="32px" /></span>
                  </div>
                </div>
                <ArrowRight className="landing-bento-flow__arrow" aria-hidden="true" />
                <div className="landing-bento-flow__stage">
                  <span>Shortlist</span>
                  <div className="landing-bento-flow__faces">
                    <span className="landing-mini-avatar"><Image src="/hero/03.jpg" alt="" fill sizes="32px" /></span>
                    <span className="landing-mini-avatar"><Image src="/hero/09.jpg" alt="" fill sizes="32px" /></span>
                  </div>
                </div>
                <ArrowRight className="landing-bento-flow__arrow" aria-hidden="true" />
                <div className="landing-bento-flow__stage landing-bento-flow__stage--message">
                  <span>Reach out</span>
                  <p>“Hi Maya — we’re casting a two-day commercial shoot in March and your movement work stood out…”</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="landing-outcomes" aria-label="What Atlas is built to do">
        <div className="landing-outcome">
          <h3>Specific in, specific out</h3>
          <p>Search by the details that make a brief specific — language, movement, look, availability.</p>
        </div>
        <div className="landing-outcome">
          <h3>Explainable matches</h3>
          <p>See why each person surfaced when Atlas has structured signals; weaker hits may show a generic reason.</p>
        </div>
        <div className="landing-outcome">
          <h3>One connected flow</h3>
          <p>Keep discovery, shortlisting, and outreach together instead of scattered across tools.</p>
        </div>
      </section>

      <section className="landing-section landing-section--soft" id="use-cases" aria-label="Real briefs Atlas handles">
        <div className="landing-section__heading">
          <p className="landing-eyebrow">Built for real briefs</p>
          <h2>If you can say it, you can search it.</h2>
          <p>Every project starts with a sentence. These are the kinds Atlas is built for.</p>
        </div>

        <div className="landing-briefs">
          {briefExamples.map(example => (
            <article className={`landing-brief-card landing-brief-card--${example.visual}`} key={example.category}>
              <div className="landing-brief-card__visual" aria-hidden="true">
                <div className="landing-brief-card__chrome">
                  <i /><i /><i />
                  <span>atlas.ai</span>
                </div>

                {example.visual === 'search' && (
                  <div className="landing-brief-card__search">
                    <div><Search /><span>Find a bilingual presenter in London</span></div>
                    <p><span>Language: Hindi</span><span>Travel ready</span><span>Dec availability</span></p>
                  </div>
                )}

                {example.visual === 'casting' && (
                  <div className="landing-brief-card__casting">
                    <div className="landing-brief-card__casting-tabs"><span className="is-active">Strong matches</span><span>All profiles</span></div>
                    <div className="landing-brief-card__casting-portraits">
                      <Image src="/hero/10.jpg" alt="" fill sizes="200px" />
                      <Image src="/hero/08.jpg" alt="" fill sizes="200px" />
                      <Image src="/hero/13.jpg" alt="" fill sizes="200px" />
                    </div>
                    <div><span>Sixties look</span><span>Equestrian</span><span>Supporting cast</span></div>
                  </div>
                )}

                {example.visual === 'campaign' && (
                  <div className="landing-brief-card__campaign">
                    <div className="landing-brief-card__campaign-profile">
                      <span className="landing-mini-avatar"><Image src="/hero/06.jpg" alt="" fill sizes="32px" /></span>
                      <span><b>Nia Okafor</b><small>Creator · Host · Director</small></span>
                      <strong>Example</strong>
                    </div>
                    <div className="landing-brief-card__campaign-bars">
                      <span><i /><b>On-camera presence</b></span>
                      <span><i /><b>Lifestyle audience fit</b></span>
                      <span><i /><b>Short-form experience</b></span>
                    </div>
                  </div>
                )}

                {example.visual === 'availability' && (
                  <div className="landing-brief-card__availability">
                    <div><CalendarDays /><span>Manchester · March</span></div>
                    <p><i /> Available for both show dates · Bhangra troupe</p>
                  </div>
                )}

                {example.visual === 'photo_video' && (
                  <div className="landing-brief-card__crew">
                    <div className="landing-brief-card__crew-filter"><SlidersHorizontal /><span>Photographer</span><span>Music videos</span><span>Next month</span></div>
                    <div className="landing-brief-card__crew-map">
                      <MapPin /><i /><i /><i /><i />
                    </div>
                    <div className="landing-brief-card__crew-footer"><span>Photographer &amp; videographer category</span><Send /></div>
                  </div>
                )}
              </div>
              <div className="landing-brief-card__copy">
                <span>{example.category}</span>
                <p>“{example.brief}”</p>
              </div>
            </article>
          ))}
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
              <div className="landing-mini-window__header">
                <span className="landing-mini-window__brand"><Image src="/brand/northstar-studios.svg" alt="" width={17} height={17} />Brief</span>
                <span>3 strong matches</span>
              </div>
              <div className="landing-mini-brief"><span className="landing-mini-brief__icon"><Search /></span><span>Hindi-speaking performer<br /><b>in London · available December</b></span></div>
              <div className="landing-mini-row"><span className="landing-mini-avatar landing-result__avatar--lime"><Image src="/hero/01.jpg" alt="" fill sizes="32px" /></span><span><b>Priya Singh</b><small>Example · Bollywood</small></span><strong>—</strong></div>
              <div className="landing-mini-row"><span className="landing-mini-avatar landing-result__avatar--lavender"><Image src="/hero/12.jpg" alt="" fill sizes="32px" /></span><span><b>Aisha Khan</b><small>Example · Bhangra</small></span><strong>—</strong></div>
              <div className="landing-mini-row"><span className="landing-mini-avatar landing-result__avatar--indigo"><Image src="/hero/02.jpg" alt="" fill sizes="32px" /></span><span><b>Ravi Mehta</b><small>Example · Movement</small></span><strong>—</strong></div>
            </div>
          </div>
        </article>

        <article className="landing-audience landing-audience--talent" id="for-talent">
          <div className="landing-audience__visual" aria-hidden="true">
            <div className="landing-profile-card">
              <div className="landing-profile-card__top"><span className="landing-mini-avatar landing-result__avatar--lavender"><Image src="/hero/06.jpg" alt="" fill sizes="32px" /></span><span className="landing-profile-card__status"><i />Profile discoverable</span></div>
              <div className="landing-profile-card__name"><b>Nia Okafor</b><span>Creator · Director · Host</span></div>
              <div className="landing-profile-card__tags"><span>Lifestyle</span><span>Short-form video</span><span>On-camera</span></div>
              <div className="landing-profile-card__meter"><span><b>Profile strength</b><b>Example</b></span><i><em /></i></div>
              <div className="landing-profile-card__footer"><span>Discover jobs matched to your skills</span><ArrowUpRight /></div>
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
        <div className="landing-footer__links"><Link href="/login">Sign in</Link><Link href="/signup">Create account</Link><Link href="/terms">Terms of Service</Link><Link href="/privacy">Privacy Policy</Link><a href="#top">Back to top <ArrowUpRight aria-hidden="true" /></a></div>
        <p className="landing-footer__copyright">© 2026 Atlas</p>
      </footer>
    </main>
  )
}
