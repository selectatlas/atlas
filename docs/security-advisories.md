# Accepted dependency advisories

This file records every known production advisory that is deliberately accepted
instead of fixed, why it is unreachable, and when the acceptance expires. CI
fails on any high-severity production advisory (`npm audit --omit=dev
--audit-level=high`), so anything listed here must be moderate or below, or
have an entry explaining an active exception.

## GHSA-qx2v-qp2m-jg93 - postcss < 8.5.10 (moderate)

- **Path:** `next@16.2.7` bundles an affected `postcss` version.
- **Status:** Accepted, time-bounded.
- **Why it is unreachable:** The advisory is an XSS via unescaped `</style>`
  in PostCSS *stringify output*. PostCSS runs at build time over this
  repository's own Tailwind CSS. Atlas never compiles user-supplied CSS, so no
  attacker-controlled input reaches the vulnerable code path.
- **Fix condition:** Upgrade Next.js as soon as a stable release ships with
  `postcss >= 8.5.10`. As of 2026-07-14 every published Next.js release up to
  `16.3.0-canary.5` still bundles the affected version, and the npm-suggested
  "fix" is a breaking downgrade to `next@9.3.3`, which must not be applied.
- **Review by:** 2026-08-14, or at the next Next.js upgrade, whichever is
  sooner.

## Resolved history

- **`shadcn` CLI hono chain (1 high, previously in production dependencies):**
  resolved by moving `shadcn` to `devDependencies` (commit `660bce5`). It is a
  code-generation CLI and ships nothing to production. `npm audit --omit=dev`
  no longer reports it.
