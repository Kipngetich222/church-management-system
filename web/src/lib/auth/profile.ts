import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Where members are sent to finish the personal-details widget. */
export const PROFILE_COMPLETION_PATH = '/complete-profile'

export type MemberCategory = 'men' | 'women' | 'youth'

/** The person-level fields we require before someone can use the app. */
export type ProfileCompletion = {
  phone: string | null
  gender: string | null
  category: string | null
}

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const

export const CATEGORY_OPTIONS = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'youth', label: 'Youth' },
] as const

/**
 * A profile is complete once the mandatory personal details are filled in:
 * phone (required) plus gender and category. Date of birth stays optional.
 */
export function isProfileComplete(
  profile: ProfileCompletion | null | undefined
): boolean {
  if (!profile) return false
  return (
    Boolean(profile.phone?.trim()) &&
    Boolean(profile.gender?.trim()) &&
    Boolean(profile.category?.trim())
  )
}

/**
 * Look up whether a user has finished their profile.
 *
 * Fails open (returns true) if the lookup itself errors, so a schema hiccup can
 * never lock every user out of the app behind the completion widget.
 */
export async function isProfileCompleteForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('phone, gender, category')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to check profile completion:', error)
    return true
  }

  return isProfileComplete(data)
}
