import type { PostgrestError } from '@supabase/supabase-js'
import type { Json } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/services/email.service'
import { planMemberLimit, planName, type PlanTier } from '@/lib/constants/plans'

/**
 * Plan handling for a church. Plans only differ by member capacity - every
 * feature is available on every plan - so most of this file is about counting
 * seats and moving a church onto a bigger plan when it outgrows its cap.
 */

export type PlanUsage = {
  plan: PlanTier
  planName: string
  /** null when the plan has no member cap. */
  memberLimit: number | null
  memberCount: number
  /** Seats left before the cap is reached. null when unlimited. */
  remaining: number | null
  atLimit: boolean
}

type UsageRow = {
  plan: PlanTier
  member_limit: number | null
  member_count: number
}

function toUsage(row: UsageRow): PlanUsage {
  const limit = row.member_limit
  const memberCount = row.member_count ?? 0
  return {
    plan: row.plan,
    planName: planName(row.plan),
    memberLimit: limit,
    memberCount,
    remaining: limit === null ? null : Math.max(0, limit - memberCount),
    atLimit: limit !== null && memberCount >= limit,
  }
}

/** Current plan and member usage for a church. */
export async function getPlanUsage(churchId: string): Promise<PlanUsage> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_church_plan_usage', {
    p_church_id: churchId,
  })

  if (error) throw new Error(error.message)

  const row = (data as unknown as UsageRow[] | null)?.[0]
  if (!row) throw new Error('Church not found')

  // The RPC returns the raw cap; derive the rest in one place.
  return toUsage({
    plan: row.plan,
    member_limit: row.member_limit ?? planMemberLimit(row.plan),
    member_count: row.member_count,
  })
}

/** Move a church onto another plan. All feature access stays identical. */
export async function changeChurchPlan(params: {
  churchId: string
  plan: PlanTier
  actorId: string
}): Promise<PlanUsage> {
  const admin = createAdminClient()

  const { data: church, error: readError } = await admin
    .from('churches')
    .select('id, plan')
    .eq('id', params.churchId)
    .maybeSingle()

  if (readError) throw new Error(readError.message)
  if (!church) throw new Error('Church not found')

  const previous = church.plan as PlanTier

  if (previous !== params.plan) {
    const { error: updateError } = await admin
      .from('churches')
      .update({ plan: params.plan })
      .eq('id', params.churchId)

    if (updateError) throw new Error(updateError.message)

    await admin.from('audit_logs').insert({
      church_id: params.churchId,
      actor_id: params.actorId,
      action: 'church.plan_changed',
      entity_type: 'church',
      entity_id: params.churchId,
      metadata: { from: previous, to: params.plan } as Json,
    })
  }

  return getPlanUsage(params.churchId)
}

/** True when a failed insert was rejected by the plan member cap. */
export function isMemberLimitError(
  error: PostgrestError | { message?: string } | null | undefined
): boolean {
  return Boolean(error?.message?.includes('member limit'))
}

/**
 * Tell a church's super admins that somebody tried to join but the church is
 * full. Best-effort: a mail failure never blocks the join response.
 */
export async function notifyMemberLimitReached(params: {
  churchId: string
  churchName: string
  memberLimit: number
  attemptedName?: string | null
  attemptedEmail?: string | null
}): Promise<void> {
  const admin = createAdminClient()

  // Keep an in-app trail so admins browsing Audit Logs can see the attempt,
  // not just the email that goes out below.
  await admin.from('audit_logs').insert({
    church_id: params.churchId,
    actor_id: null,
    action: 'membership.join_blocked_plan_limit',
    entity_type: 'church',
    entity_id: params.churchId,
    metadata: {
      attempted_name: params.attemptedName ?? null,
      attempted_email: params.attemptedEmail ?? null,
      member_limit: params.memberLimit,
    } as Json,
  })

  const { data } = await admin
    .from('church_memberships')
    .select('users!church_memberships_user_id_fkey(email)')
    .eq('church_id', params.churchId)
    .eq('role', 'super_admin')

  const emails = (
    (data ?? []) as unknown as {
      users?: { email?: string | null } | null
    }[]
  )
    .map((row) => row.users?.email ?? null)
    .filter((email): email is string => Boolean(email))

  if (!emails.length) return

  const who = params.attemptedName ?? params.attemptedEmail ?? 'Someone'

  try {
    await sendEmail({
      to: emails,
      subject: `${params.churchName} has reached its member limit`,
      html:
        `<p>Heads up,</p>` +
        `<p><strong>${who}</strong> tried to join <strong>${params.churchName}</strong>, ` +
        `but your church is on the <strong>Starter</strong> plan and has reached its ` +
        `limit of ${params.memberLimit} members. No one new can join until you upgrade.</p>` +
        `<p>You can upgrade to the <strong>Growth</strong> plan any time from ` +
        `Plan &amp; Billing in your admin dashboard.</p>`,
    })
  } catch (error) {
    console.error('Failed to send member-limit notification:', error)
  }
}
