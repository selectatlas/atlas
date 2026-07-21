import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

export const API_URL =
  process.env.SUPABASE_TEST_URL ?? process.env.API_URL ?? 'http://127.0.0.1:55321'
export const SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? ''

export const PASSWORD = 'e2e-test-password-1'

export function adminClient(): SupabaseClient {
  return createClient(API_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@atlas-e2e.test`
}

// Seed a confirmed user directly (for specs that test behaviour after signup;
// the signup UI itself is covered by auth.spec.ts).
export async function seedUser(
  admin: SupabaseClient,
  accountType: 'hirer' | 'talent',
  label: string,
): Promise<{ id: string; email: string }> {
  const email = uniqueEmail(label)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { account_type: accountType, full_name: `E2E ${label}` },
  })
  if (error || !data.user) throw new Error(`seedUser(${label}) failed: ${error?.message}`)
  return { id: data.user.id, email }
}

export async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Login lands on the role workspace dashboard (safeInternalPath fallback).
  await page.waitForURL(/\/home/)
}

export async function signupViaUi(
  page: Page,
  accountType: 'hirer' | 'talent',
  label: string,
): Promise<string> {
  const email = uniqueEmail(label)
  await page.goto('/signup')
  await page
    .getByRole('button', { name: accountType === 'hirer' ? /I'm Hiring/ : /I'm Talent/ })
    .click()
  await page.fill('#fullName', `E2E ${label}`)
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  return email
}
