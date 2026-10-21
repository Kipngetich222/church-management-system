import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { LEGAL_VERSION } from '@/lib/legal'

type LegalProfile = {
  terms_accepted_at: string | null
  privacy_accepted_at: string | null
  legal_version: string | null
}

/** Whether the user has accepted the current revision of both documents. */
export function hasAcceptedLegal(profile: LegalProfile | null | undefined) {
  return Boolean(
    profile?.terms_accepted_at &&
    profile.privacy_accepted_at &&
    profile.legal_version === LEGAL_VERSION
  )
}

/** Persist a user's acceptance of the current Terms and Privacy Policy. */
export async function recordLegalConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  acceptedAt = new Date().toISOString(),
  version = LEGAL_VERSION
) {
  const { error } = await supabase
    .from('users')
    .update({
      terms_accepted_at: acceptedAt,
      privacy_accepted_at: acceptedAt,
      legal_version: version,
    })
    .eq('id', userId)

  return error
}
