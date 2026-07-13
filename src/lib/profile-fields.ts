/**
 * Profile fields that are safe to return to another signed-in user.
 *
 * Keep this list aligned with the column-level grants in migration 005. Email
 * deliberately comes from Supabase Auth for the current user's own profile and
 * must never be selected from public.profiles in product code.
 */
// These stay as string literals (rather than runtime joins) so Supabase's
// compile-time select parser can infer the returned shape.
export const PUBLIC_PROFILE_FIELDS =
  'id, account_type, full_name, avatar_url, cover_url, headline, city, country, bio, rates, availability, showreel_url, created_at' as const

export const PUBLIC_TALENT_SKILL_FIELDS =
  'id, profile_id, category, skill, proficiency, created_at' as const

export const PUBLIC_PROFILE_WITH_SKILLS =
  'id, account_type, full_name, avatar_url, cover_url, headline, city, country, bio, rates, availability, showreel_url, created_at, talent_skills(id, profile_id, category, skill, proficiency, created_at)' as const
