'use client'

import { createClient } from '@/lib/supabase/client'

export async function logAuditClient(params: {
  churchId: string
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, any>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('audit_logs').insert({
    church_id: params.churchId,
    actor_id: user.id,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
  })
}