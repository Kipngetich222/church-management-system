import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

export async function logAudit(params: {
  churchId: string
  action: string
  entityType: string
  entityId?: string
  metadata?: Json
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
