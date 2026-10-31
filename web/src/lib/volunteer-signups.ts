import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export async function changeVolunteerParticipation(
  supabase: SupabaseClient<Database>,
  {
    shiftId,
    membershipId,
    signedUp,
    signupId,
  }: {
    shiftId: string
    membershipId: string
    signedUp: boolean
    signupId: string | null
  }
) {
  if (signedUp && !signupId)
    throw new Error('Refresh the page to load your current participation.')

  if (signupId) {
    // Only remove the record shown on this page. A newer signup may have
    // been created in another tab since this page loaded.
    let removal = supabase
      .from('volunteer_signups')
      .delete()
      .eq('id', signupId)
      .eq('shift_id', shiftId)
      .eq('membership_id', membershipId)
    if (!signedUp) removal = removal.eq('status', 'cancelled')
    const { error } = await removal
    if (error) throw error
  }

  if (!signedUp) {
    const { error } = await supabase
      .from('volunteer_signups')
      .insert({
        shift_id: shiftId,
        membership_id: membershipId,
        status: 'confirmed',
      })
      .select('id')
      .single()
    if (error) throw error
  }
}
