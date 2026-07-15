#!/usr/bin/env node
// Fails when a server-only secret VALUE appears in client-shipped artifacts.
// Scans .next/static plus HTML/RSC flight payloads under .next/server.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const NEXT_DIR = join(process.cwd(), '.next')
const STATIC_DIR = join(NEXT_DIR, 'static')
const SERVER_DIR = join(NEXT_DIR, 'server')
const ENV_TS = join(process.cwd(), 'src/lib/env.ts')

function loadServerOnlyEnv() {
  const src = readFileSync(ENV_TS, 'utf8')
  const match = src.match(/export const SERVER_ONLY_ENV = (\[[^\]]+\]) as const/)
  if (!match) {
    throw new Error('Could not parse SERVER_ONLY_ENV from src/lib/env.ts')
  }
  return JSON.parse(match[1].replace(/'/g, '"'))
}

const SERVER_ONLY = loadServerOnlyEnv()

if (!existsSync(STATIC_DIR)) {
  console.error('No .next/static directory - run `npm run build` first.')
  process.exit(2)
}

const secrets = SERVER_ONLY
  .map(name => ({ name, value: process.env[name] }))
  .filter(({ value }) => typeof value === 'string' && value.length > 0)

if (secrets.length === 0) {
  console.error(
    'None of the server-only variables are set ' +
      `(${SERVER_ONLY.join(', ')}). Set them to the values the build used.`,
  )
  process.exit(2)
}

function variants(value) {
  const set = new Set([value])
  try { set.add(decodeURIComponent(value)) } catch { /* ignore */ }
  try { set.add(Buffer.from(value, 'utf8').toString('base64')) } catch { /* ignore */ }
  return [...set]
}

function* walk(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}

function shouldScan(file) {
  if (/\.(js|json|txt|map|html|rsc)$/.test(file)) return true
  if (file.includes(`${join('server', 'app')}`) && !file.endsWith('.meta')) return true
  return false
}

const scanRoots = [STATIC_DIR, SERVER_DIR]
const leaks = []
let scanned = 0

for (const root of scanRoots) {
  for (const file of walk(root)) {
    if (!shouldScan(file)) continue
    scanned += 1
    const content = readFileSync(file, 'utf8')
    for (const { name, value } of secrets) {
      for (const needle of variants(value)) {
        if (needle.length > 0 && content.includes(needle)) {
          leaks.push(`${name} found in ${file}`)
          break
        }
      }
    }
  }
}

if (leaks.length > 0) {
  console.error('SECRET LEAKED INTO CLIENT-SHIPPED ARTIFACT:')
  for (const leak of leaks) console.error(`  - ${leak}`)
  process.exit(1)
}

console.log(`OK: scanned ${scanned} files; no server-only secret values present.`)
