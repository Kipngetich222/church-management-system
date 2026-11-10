import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  checked,
  communicationDb,
  CommunicationError,
} from '@/lib/communication'

export const campaignSchema = z.object({
  churchId: z.string().uuid(),
  channel: z.enum(['sms', 'email', 'in_app']).default('sms'),
  body: z.string().trim().min(1).max(1600),
  subject: z.string().max(200).optional(),
  recipientFilter: z.object({
    type: z.enum([
      'all',
      'department',
      'group',
      'custom',
      'category',
      'leaders',
    ]),
    ids: z.array(z.string().min(1).max(100)).max(10000).default([]),
  }),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  requestId: z.string().uuid(),
})

export async function communicationActor(churchId: string, superOnly = false) {
  if (!z.string().uuid().safeParse(churchId).success)
    throw new CommunicationError('Invalid church ID')
  const client = await createClient()
  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user) throw new CommunicationError('Please sign in', 401)
  const db = communicationDb(createAdminClient())
  const membership = checked(
    await db
      .from('church_memberships')
      .select('id, role, full_name')
      .eq('church_id', churchId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
  )
  if (
    !membership ||
    !['super_admin', 'dept_admin'].includes(membership.role) ||
    (superOnly && membership.role !== 'super_admin')
  )
    throw new CommunicationError(
      'You do not have permission for this church',
      403
    )
  return { user, membership, db }
}

export function communicationFailure(error: unknown) {
  if (error instanceof z.ZodError)
    return Response.json(
      { error: error.issues[0]?.message || 'Invalid request' },
      { status: 400 }
    )
  if (error instanceof SyntaxError)
    return Response.json({ error: 'Invalid JSON request' }, { status: 400 })
  if (error instanceof CommunicationError)
    return Response.json({ error: error.message }, { status: error.status })
  console.error(
    'Communication request failed',
    error instanceof Error ? error.message : 'Unknown error'
  )
  return Response.json(
    {
      error:
        'Unable to complete this request. Refresh the history before trying again.',
    },
    { status: 500 }
  )
}
