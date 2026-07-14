import { createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/openai'
import { logEvent } from '@/lib/log'

export interface EmbeddableJob {
  id: string
  title: string
  description: string
  skills_required: string[] | null
}

// Embed a job and record the outcome on the jobs row. Callers must await this
// (a serverless worker may stop after the response is sent). Idempotent:
// job_id is the job_embeddings primary key, so retries can never create a
// second embedding for the same job.
export async function embedJob(job: EmbeddableJob): Promise<{ status: 'complete' | 'failed' }> {
  const service = createServiceClient()
  const sourceText = `${job.title} ${job.description} ${(job.skills_required ?? []).join(' ')}`

  // Best-effort attempt counter; failures here must not mask the outcome.
  await service
    .rpc('increment_job_embedding_attempts', { p_job_id: job.id })
    .then(() => undefined, () => undefined)

  try {
    const embedding = await embedText(sourceText)
    const { error } = await service
      .from('job_embeddings')
      .upsert({ job_id: job.id, embedding, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)

    await service
      .from('jobs')
      .update({ embedding_status: 'complete', embedding_error: null })
      .eq('id', job.id)
    return { status: 'complete' }
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : 'unknown'
    logEvent('error', 'job_embedding_error', { job_id: job.id, message })
    await service
      .from('jobs')
      .update({ embedding_status: 'failed', embedding_error: message })
      .eq('id', job.id)
    return { status: 'failed' }
  }
}
