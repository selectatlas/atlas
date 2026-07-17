import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern your use of Atlas, the AI-native talent discovery platform.',
  alternates: { canonical: '/terms' },
}

const sectionClass = 'space-y-3'
const headingClass = 'text-base font-semibold tracking-tight'
const bodyClass = 'text-sm leading-relaxed text-muted-foreground'
const listClass = 'list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground'

export default function TermsPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="text-xs text-muted-foreground">Last updated: 14 July 2026</p>
        <p className={bodyClass}>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of Atlas - the
          AI-native talent discovery platform available through our website and apps (the
          &quot;Service&quot;). By creating an account or using the Service, you agree to these Terms.
          If you do not agree, do not use the Service.
        </p>
      </header>

      <section className={sectionClass}>
        <h2 className={headingClass}>1. Who we are</h2>
        <p className={bodyClass}>
          Atlas connects creative professionals (&quot;Talent&quot;) - including actors, models,
          dancers, photographers, and videographers - with people and organisations looking to hire
          them (&quot;Hirers&quot;). Atlas is a discovery and introduction platform: we are not a party
          to any engagement, booking, or contract formed between Talent and Hirers.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>2. Eligibility and accounts</h2>
        <ul className={listClass}>
          <li>You must be at least 18 years old to create an account.</li>
          <li>You must provide accurate information when registering and keep it up to date.</li>
          <li>You are responsible for all activity that happens under your account and for keeping your login credentials secure.</li>
          <li>One person may not maintain multiple accounts for the purpose of evading restrictions we have applied.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>3. Talent profiles and content</h2>
        <p className={bodyClass}>
          Talent may publish profile information including photos, showreels, credits, skills,
          physical characteristics, rates, and availability. By publishing content you confirm that:
        </p>
        <ul className={listClass}>
          <li>You own the content or have the rights needed to share it, including permission from anyone who appears in it.</li>
          <li>The information is truthful and not misleading - including credits, qualifications, and certifications such as stunt-register membership.</li>
          <li>Profile attributes you choose to disclose (for example physical characteristics or scene-comfort preferences) are provided voluntarily to help casting decisions.</li>
        </ul>
        <p className={bodyClass}>
          You keep ownership of your content. You grant Atlas a non-exclusive, worldwide, royalty-free
          licence to host, display, and process it for the purpose of operating and improving the
          Service, including generating search indexes and AI embeddings. This licence ends when you
          delete the content or your account, except where retention is required by law.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>4. Acceptable use</h2>
        <p className={bodyClass}>You agree not to:</p>
        <ul className={listClass}>
          <li>Use the Service for any unlawful purpose or in breach of any applicable law or regulation.</li>
          <li>Harass, discriminate against, or exploit other users, or solicit work that is unlawful.</li>
          <li>Post content that is defamatory, obscene, infringing, or that you do not have the right to share.</li>
          <li>Scrape, harvest, or bulk-export profile data, or use automated tools to access the Service without our written permission.</li>
          <li>Misrepresent your identity, qualifications, or affiliation with any person or organisation.</li>
          <li>Attempt to circumvent security measures, rate limits, or access controls.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>5. Bookings and payments</h2>
        <p className={bodyClass}>
          Any engagement agreed between a Hirer and Talent - including fees, usage rights, scheduling,
          insurance, and working conditions - is a contract solely between those parties. Rates shown
          on profiles are indicative and set by Talent. Atlas does not process payments between users,
          does not guarantee any level of work or response, and is not responsible for the conduct of
          any user on or off the platform. Hirers are responsible for verifying credentials that matter
          to their production, including certifications, right to work, and insurance.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>6. AI features</h2>
        <p className={bodyClass}>
          The Service uses artificial intelligence to interpret search queries, rank results, and
          suggest matches. AI output is assistive and may be inaccurate or incomplete. Match scores
          and suggestions are not endorsements, and hiring decisions remain entirely with the Hirer.
          We may use third-party AI providers to process queries and profile text as described in our
          Privacy Policy.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>7. Intellectual property</h2>
        <p className={bodyClass}>
          The Service, including its software, design, and branding, is owned by Atlas or its
          licensors and is protected by intellectual property laws. Except for the rights expressly
          granted in these Terms, no rights in the Service are transferred to you.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>8. Suspension and termination</h2>
        <p className={bodyClass}>
          You may close your account at any time. We may suspend or terminate your access if you
          breach these Terms, if we are required to by law, or if we reasonably believe your use
          poses a risk to other users or the Service. Where practical, we will notify you and give
          you a chance to export your content first.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>9. Disclaimers and liability</h2>
        <p className={bodyClass}>
          The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent
          permitted by law, we exclude all implied warranties and are not liable for loss of profits,
          loss of opportunity, or indirect or consequential loss arising from your use of the Service
          or from engagements formed through it. Nothing in these Terms limits liability that cannot
          be limited by law, including liability for death or personal injury caused by negligence, or
          for fraud.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>10. Changes to these Terms</h2>
        <p className={bodyClass}>
          We may update these Terms from time to time. If a change is material, we will give you
          reasonable notice - for example by email or an in-product notice - before it takes effect.
          Continuing to use the Service after a change takes effect means you accept the updated Terms.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>11. Governing law</h2>
        <p className={bodyClass}>
          These Terms are governed by the laws of England and Wales, and the courts of England and
          Wales have exclusive jurisdiction over any dispute arising from them, except where the law
          of your country of residence gives you mandatory additional protections.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>12. Contact</h2>
        <p className={bodyClass}>
          Questions about these Terms can be sent to{' '}
          <a href="mailto:hello@atlas.select" className="text-foreground underline underline-offset-2">
            hello@atlas.select
          </a>.
        </p>
      </section>
    </article>
  )
}
