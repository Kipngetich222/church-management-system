import { createClient } from '@/lib/supabase/server'
import { SETUP_STEPS, type SetupStepKey } from '@/lib/constants/setup-steps'

export type ChurchSetupStep = {
  key: SetupStepKey
  label: string
  description: string
  href: string
  done: boolean
}

export type ChurchSetup = {
  steps: ChurchSetupStep[]
  completedCount: number
  total: number
  isComplete: boolean
}

type ChurchProfile = {
  name?: string | null
  logo_url?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

/**
 * Derive the church onboarding checklist from live data so steps tick
 * themselves off as the admin completes them. A step is only "done" when the
 * underlying record actually exists.
 */
export async function getChurchSetup(
  churchId: string,
  church: ChurchProfile
): Promise<ChurchSetup> {
  const supabase = await createClient()

  const [membersResult, departmentsResult, eventsResult] = await Promise.all([
    supabase
      .from('church_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId),
    supabase
      .from('departments')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId),
  ])

  for (const result of [membersResult, departmentsResult, eventsResult]) {
    if (result.error) console.error('Failed to count setup rows:', result.error)
  }

  const profileDone =
    Boolean(church.name?.trim()) &&
    Boolean(church.address?.trim()) &&
    church.latitude != null &&
    church.longitude != null

  const doneByKey: Record<SetupStepKey, boolean> = {
    profile: profileDone,
    members: (membersResult.count ?? 0) > 0,
    departments: (departmentsResult.count ?? 0) > 0,
    events: (eventsResult.count ?? 0) > 0,
  }

  const steps = SETUP_STEPS.map((step) => ({
    ...step,
    done: doneByKey[step.key],
  }))

  const completedCount = steps.filter((step) => step.done).length

  return {
    steps,
    completedCount,
    total: steps.length,
    isComplete: completedCount === steps.length,
  }
}
