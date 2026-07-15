import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Atlas collects, uses, and protects your personal data.',
  alternates: { canonical: '/privacy' },
}

const sectionClass = 'space-y-3'
const headingClass = 'text-base font-semibold tracking-tight'
const bodyClass = 'text-sm leading-relaxed text-muted-foreground'
const listClass = 'list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground'

export default function PrivacyPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground">Last updated: 14 July 2026</p>
        <p className={bodyClass}>
          This policy explains how Atlas (&quot;we&quot;, &quot;us&quot;) collects, uses, and protects
          your personal data when you use our talent discovery platform (the &quot;Service&quot;).
          We process personal data in accordance with UK data protection law, including the UK GDPR
          and the Data Protection Act 2018.
        </p>
      </header>

      <section className={sectionClass}>
        <h2 className={headingClass}>1. Data we collect</h2>
        <ul className={listClass}>
          <li><span className="text-foreground">Account data</span> - name, email address, account type (hirer or talent), and password credentials managed by our authentication provider.</li>
          <li><span className="text-foreground">Profile data (talent)</span> - the information you choose to publish, such as photos, showreels, bio, location, skills, credits, qualifications, languages, rates, and availability.</li>
          <li><span className="text-foreground">Optional casting attributes (talent)</span> - physical characteristics (for example height, hair type, or skin tone) and work preferences (for example scene-comfort preferences) that you may add to help casting decisions. Providing these is entirely voluntary.</li>
          <li><span className="text-foreground">Usage data</span> - searches, profile views, likes, shortlists, and messages sent through the platform.</li>
          <li><span className="text-foreground">Technical data</span> - IP address, device and browser information, and cookies needed to keep you signed in and to protect the Service (for example rate limiting).</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>2. How we use your data</h2>
        <ul className={listClass}>
          <li>To operate the Service - creating your account, displaying talent profiles to signed-in hirers, and delivering messages between users.</li>
          <li>To power search - your search queries and talent profile text are processed by AI models to interpret briefs and rank results.</li>
          <li>To keep the Service safe - authentication, rate limiting, abuse detection, and enforcing our Terms of Service.</li>
          <li>To communicate with you - service emails such as password resets and important account notices.</li>
          <li>To improve the Service - aggregated, de-identified analysis of how features are used.</li>
        </ul>
        <p className={bodyClass}>
          We rely on the performance of our contract with you, our legitimate interests in operating
          and securing the Service, and - for optional casting attributes that reveal sensitive
          information - your explicit consent, which you can withdraw at any time by removing the
          information from your profile.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>3. Who can see your data</h2>
        <ul className={listClass}>
          <li>Talent profile information is visible to signed-in users of the platform. It is not published on the open web.</li>
          <li>Sensitive work preferences are restricted: they are stored separately and only surfaced to authenticated hirers through controlled search and profile features.</li>
          <li>Messages are visible only to the participants in the conversation.</li>
          <li>We never sell your personal data.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>4. Service providers</h2>
        <p className={bodyClass}>
          We share data with a small number of processors who help us run the Service, under
          contracts that protect your data:
        </p>
        <ul className={listClass}>
          <li>Supabase - database, authentication, and file storage.</li>
          <li>Vercel - application hosting and content delivery.</li>
          <li>OpenAI - processing of search queries and profile text to power AI search. This data is not used by OpenAI to train its models.</li>
        </ul>
        <p className={bodyClass}>
          Some providers process data outside the UK. Where they do, transfers are protected by
          appropriate safeguards such as the UK International Data Transfer Agreement or adequacy
          decisions.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>5. Cookies</h2>
        <p className={bodyClass}>
          We use strictly necessary cookies to keep you signed in and to protect the Service. We do
          not use third-party advertising cookies.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>6. Retention</h2>
        <p className={bodyClass}>
          We keep your data for as long as your account is active. When you delete your account, your
          profile, messages, and associated data are deleted, except for limited records we must keep
          to comply with legal obligations or resolve disputes. Backups are purged on a rolling
          schedule.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>7. Your rights</h2>
        <p className={bodyClass}>Under UK data protection law you have the right to:</p>
        <ul className={listClass}>
          <li>Access a copy of the personal data we hold about you.</li>
          <li>Correct inaccurate data - most profile data you can edit directly in your account.</li>
          <li>Delete your data (&quot;right to erasure&quot;).</li>
          <li>Restrict or object to certain processing.</li>
          <li>Data portability - receive your data in a machine-readable format.</li>
          <li>Withdraw consent at any time where processing is based on consent.</li>
        </ul>
        <p className={bodyClass}>
          To exercise any of these rights, contact us using the details below. You also have the
          right to complain to the Information Commissioner&apos;s Office (ICO) at{' '}
          <a href="https://ico.org.uk" className="text-foreground underline underline-offset-2" rel="noopener noreferrer" target="_blank">
            ico.org.uk
          </a>.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>8. Security</h2>
        <p className={bodyClass}>
          We protect your data with industry-standard measures including encryption in transit,
          row-level access controls in our database, role-checked APIs, and rate limiting. No system
          is completely secure, so please use a strong, unique password for your account.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>9. Children</h2>
        <p className={bodyClass}>
          The Service is for adults. We do not knowingly collect data from anyone under 18. If you
          believe a minor has created an account, contact us and we will remove it.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>10. Changes to this policy</h2>
        <p className={bodyClass}>
          We may update this policy as the Service evolves. If a change is material, we will notify
          you by email or an in-product notice before it takes effect. The &quot;Last updated&quot;
          date at the top shows the current version.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>11. Contact</h2>
        <p className={bodyClass}>
          Privacy questions and rights requests can be sent to{' '}
          <a href="mailto:hello@flowconverts.com" className="text-foreground underline underline-offset-2">
            hello@flowconverts.com
          </a>.
        </p>
      </section>
    </article>
  )
}
