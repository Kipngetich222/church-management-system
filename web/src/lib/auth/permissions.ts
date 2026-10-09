import { createClient } from '@/lib/supabase/server'
import { can, type Permission } from '@/lib/auth/can'

export type { Permission }
export { can }

export async function getRolePermissions(churchId: string, role: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('role_permissions')
    .select('permissions')
    .eq('church_id', churchId)
    .eq('role', role)
    .single()
  return data?.permissions ?? []
}

export async function userCan(
  churchId: string,
  role: string,
  required: string
): Promise<boolean> {
  const perms = await getRolePermissions(churchId, role)
  return can(perms, required)
}
