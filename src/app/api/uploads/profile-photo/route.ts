import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { verifyImage, MAX_IMAGE_BYTES } from '@/lib/image-verification'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

const BUCKETS = ['avatars', 'covers'] as const

// POST /api/uploads/profile-photo — server-verified profile media upload.
// Verifies real file content (magic bytes) before storage, uploads through
// the caller's own session so storage RLS ownership still applies, and
// removes replaced files so old photos do not accumulate.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await enforceRateLimit(`uploads:${user.id}`, 3600, 20)
  if (limited) return limited

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const bucket = form.get('bucket')
  if (typeof bucket !== 'string' || !BUCKETS.includes(bucket as typeof BUCKETS[number])) {
    return Response.json({ error: 'bucket must be avatars or covers' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'file is required' }, { status: 400 })
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: 'Image must be under 5MB' }, { status: 413 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const verified = verifyImage(bytes, file.type)
  if (!verified.ok) {
    logEvent('warn', 'upload_rejected', { user_id: user.id, declared_type: file.type, size: file.size })
    return Response.json({ error: verified.reason }, { status: 400 })
  }

  // Non-guessable name under the caller's own folder (enforced by storage RLS)
  const path = `${user.id}/${randomUUID()}.${verified.extension}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: verified.mimeType, upsert: false })

  if (uploadError) {
    logEvent('error', 'upload_failed', { user_id: user.id, bucket, message: uploadError.message })
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Best-effort cleanup: remove previously uploaded files in this bucket so
  // replaced photos do not accumulate. Never fails the request.
  try {
    const { data: existing } = await supabase.storage.from(bucket).list(user.id)
    const stale = (existing ?? [])
      .filter(item => `${user.id}/${item.name}` !== path)
      .map(item => `${user.id}/${item.name}`)
    if (stale.length > 0) {
      await supabase.storage.from(bucket).remove(stale)
    }
  } catch (err) {
    logEvent('warn', 'upload_cleanup_failed', {
      user_id: user.id,
      bucket,
      message: err instanceof Error ? err.message : 'unknown',
    })
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
  return Response.json({ url: urlData.publicUrl, path }, { status: 201 })
}
