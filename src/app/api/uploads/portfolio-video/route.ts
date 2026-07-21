import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { verifyVideo, MAX_VIDEO_BYTES } from '@/lib/video-verification'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

const BUCKET = 'portfolio'

// Separate from /api/uploads/portfolio-image only because the verification and
// size ceiling differ - both write into the same bucket and the same
// uid-scoped folder, so storage RLS treats them identically.
//
// This route exists so talent can host video we cannot embed. Instagram sends
// X-Frame-Options: DENY on its embed endpoint, so a reel can never play in an
// iframe inside Atlas; uploading the file is the only way to keep a hirer
// on-platform for that content.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Tighter than the image route: each of these is up to 100MB.
  const limited = await enforceRateLimit(`portfolio-video-uploads:${user.id}`, 3600, 12)
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
  // Checked before buffering so an oversized upload is rejected without
  // pulling 100MB+ into memory.
  if (file.size > MAX_VIDEO_BYTES) {
    return Response.json({ error: 'Video must be under 100MB' }, { status: 413 })
  }

  // Magic-byte check: the browser's declared MIME type is attacker-controlled.
  const bytes = new Uint8Array(await file.arrayBuffer())
  const verified = verifyVideo(bytes, file.type)
  if (!verified.ok) {
    logEvent('warn', 'portfolio_video_upload_rejected', {
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
    logEvent('error', 'portfolio_video_upload_failed', {
      user_id: user.id,
      message: uploadError.message,
    })
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return Response.json({ url: urlData.publicUrl, path }, { status: 201 })
}
