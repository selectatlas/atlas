import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { verifyImage, MAX_IMAGE_BYTES } from '@/lib/image-verification'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

const BUCKET = 'portfolio'

// Deliberately separate from /api/uploads/profile-photo: that route wipes
// every other file in the caller's folder after a successful upload, which is
// correct for a single avatar or cover and catastrophic for a portfolio.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Higher ceiling than profile photos: a portfolio is uploaded in batches.
  const limited = await enforceRateLimit(`portfolio-uploads:${user.id}`, 3600, 60)
  if (limited) return limited

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'file is required' }, { status: 400 })
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: 'Image must be under 5MB' }, { status: 413 })
  }

  // Magic-byte check: the browser's declared MIME type is attacker-controlled.
  const bytes = new Uint8Array(await file.arrayBuffer())
  const verified = verifyImage(bytes, file.type)
  if (!verified.ok) {
    logEvent('warn', 'portfolio_upload_rejected', {
      user_id: user.id,
      declared_type: file.type,
      size: file.size,
    })
    return Response.json({ error: verified.reason }, { status: 400 })
  }

  // Non-guessable name under the caller's own folder, which storage RLS pins
  // to their uid.
  const path = `${user.id}/${randomUUID()}.${verified.extension}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: verified.mimeType, upsert: false })

  if (uploadError) {
    logEvent('error', 'portfolio_upload_failed', { user_id: user.id, message: uploadError.message })
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return Response.json({ url: urlData.publicUrl, path }, { status: 201 })
}

// Removes an uploaded image so deleting a portfolio item does not leave the
// file orphaned in storage. Storage RLS is the real boundary; the prefix
// check here just fails fast with a clear status.
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const path = new URL(request.url).searchParams.get('path')
  if (!path) return Response.json({ error: 'path is required' }, { status: 400 })
  if (!path.startsWith(`${user.id}/`)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    logEvent('warn', 'portfolio_delete_failed', { user_id: user.id, message: error.message })
    return Response.json({ error: 'Delete failed' }, { status: 500 })
  }

  return Response.json({ success: true })
}
