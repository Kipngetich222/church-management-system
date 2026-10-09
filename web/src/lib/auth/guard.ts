import { redirect } from 'next/navigation'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { userCan } from '@/lib/auth/permissions'

export async function requirePermission(permission: string) {
  const ctx = await getActiveChurch()
  const allowed = await userCan(ctx.churchId, ctx.role, permission)
  if (!allowed) redirect('/admin/dashboard?error=forbidden')
  return ctx
}