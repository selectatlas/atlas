import { requirePlatformAdmin } from '@/lib/platform-admin'
import { parseJsonBody, cleanString, cleanOptionalString, badRequest } from '@/lib/validation'
import { logEvent } from '@/lib/log'

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const fullName = cleanString(parsedBody.body.full_name, 120)
  const email = cleanString(parsedBody.body.email, 320)?.toLowerCase() ?? null
  const city = cleanOptionalString(parsedBody.body.city, 120)
  const country = cleanOptionalString(parsedBody.body.country, 120)

  if (!fullName) return badRequest('full_name is required (max 120 characters)')
  if (!email || !email.includes('@')) return badRequest('A valid email is required')
  if (!city.ok) return badRequest('city must be 120 characters or fewer')
  if (!country.ok) return badRequest('country must be 120 characters or fewer')

  const { data: existing } = await auth.service
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return badRequest('A user with this email already exists')

  const { data: authData, error: createError } = await auth.service.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, account_type: 'talent' },
  })

  if (createError || !authData.user) {
    logEvent('error', 'admin_talent_create_failed', { code: createError?.code ?? null })
    return Response.json({ error: 'Failed to create talent account' }, { status: 500 })
  }

  const profilePatch: Record<string, string | null> = {}
  if (city.value) profilePatch.city = city.value
  if (country.value) profilePatch.country = country.value

  if (Object.keys(profilePatch).length > 0) {
    await auth.service.from('profiles').update(profilePatch).eq('id', authData.user.id)
  }

  logEvent('info', 'admin_talent_created', {
    talent_id: authData.user.id,
    admin_id: auth.userId,
  })

  return Response.json({
    talent: {
      id: authData.user.id,
      email,
      full_name: fullName,
      account_type: 'talent',
    },
  }, { status: 201 })
}
