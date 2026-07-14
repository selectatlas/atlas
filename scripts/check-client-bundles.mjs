#!/usr/bin/env node
// Fails when a server-only secret VALUE appears anywhere in the client
// JavaScript that ships to browsers (.next/static). Run after `next build`
// with the same environment the build used:
//
//   node scripts/check-client-bundles.mjs
//
// CI runs this in the database job, where real (local-stack) secrets are set.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SERVER_ONLY = ['SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
const STATIC_DIR = join(process.cwd(), '.next', 'static')

if (!existsSync(STATIC_DIR)) {
  console.error('No .next/static directory - run `npm run build` first.')
  process.exit(2)
}

const secrets = SERVER_ONLY
  .map(name => ({ name, value: process.env[name] }))
  .filter(({ value }) => typeof value === 'string' && value.length >= 12)

if (secrets.length === 0) {
  console.error(
    'None of the server-only variables are set with checkable values ' +
      `(${SERVER_ONLY.join(', ')}). Set them to the values the build used.`,
  )
  process.exit(2)
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}

const leaks = []
let scanned = 0
for (const file of walk(STATIC_DIR)) {
  if (!/\.(js|json|txt|map)$/.test(file)) continue
  scanned += 1
  const content = readFileSync(file, 'utf8')
  for (const { name, value } of secrets) {
    if (content.includes(value)) leaks.push(`${name} found in ${file}`)
  }
}

if (leaks.length > 0) {
  console.error('SECRET LEAKED INTO CLIENT BUNDLE:')
  for (const leak of leaks) console.error(`  - ${leak}`)
  process.exit(1)
}

console.log(`OK: scanned ${scanned} client files; no server-only secret values present.`)
