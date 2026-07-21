import { test, expect } from '@playwright/test'
import { login, seedUser, adminClient } from './helpers'

function expectsEmbeddingFailure() {
  const key = process.env.OPENAI_API_KEY ?? ''
  return !key || /placeholder|e2e/i.test(key)
}

test.describe('two-role job journey', () => {
  test('hirer posts a job, talent applies, hirer reviews the application', async ({ browser }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'job-hirer')
    const talent = await seedUser(admin, 'talent', 'job-talent')

    const baseURL = 'http://127.0.0.1:3111'

    // --- Hirer posts a job through the UI ---
    const hirerContext = await browser.newContext({ baseURL })
    const hirerPage = await hirerContext.newPage()
    await login(hirerPage, hirer.email)

    await hirerPage.goto('/my-jobs/new')
    // Posting now opens on the AI composer; the manual form is one click away
    // and is what this journey exercises (the AI path needs a live model).
    await hirerPage.getByRole('button', { name: /Fill it in manually/ }).click()
    await hirerPage.fill('input[placeholder*="Bollywood dancers"]', 'E2E: Dancers for showcase')
    await hirerPage.fill('textarea', 'Two-day shoot in London. Bring your best moves.')
    await hirerPage.getByRole('button', { name: 'Dancer', exact: true }).click()
    await hirerPage.fill('input[placeholder*="London, UK"]', 'London, UK')
    await hirerPage.getByRole('button', { name: /Post job/ }).click()
    // Posting lands on the job itself, where the matched-talent shortlist is.
    await hirerPage.waitForURL(/\/my-jobs\/[0-9a-f-]{36}/)

    // The job exists (embedding may be failed without an OpenAI key - the
    // job itself must still post; that failure path is by design retryable)
    const { data: job } = await admin
      .from('jobs')
      .select('id, title, embedding_status')
      .eq('hirer_id', hirer.id)
      .single()
    expect(job?.title).toBe('E2E: Dancers for showcase')
    expect(job?.embedding_status).toBe(expectsEmbeddingFailure() ? 'failed' : 'complete')

    // --- Talent applies (same production API the app uses) ---
    const talentContext = await browser.newContext({ baseURL })
    const talentPage = await talentContext.newPage()
    await login(talentPage, talent.email)

    const applyResponse = await talentPage.request.post('/api/applications', {
      data: { job_id: job!.id, note: 'I am available for those dates.' },
    })
    expect(applyResponse.status()).toBe(201)

    // Applying twice is rejected, not duplicated
    const duplicate = await talentPage.request.post('/api/applications', {
      data: { job_id: job!.id },
    })
    expect(duplicate.status()).toBe(409)

    // --- Hirer sees the application on the job page ---
    await hirerPage.goto(`/my-jobs/${job!.id}`)
    await expect(hirerPage.getByText('E2E job-talent')).toBeVisible()

    await hirerContext.close()
    await talentContext.close()
  })
})
