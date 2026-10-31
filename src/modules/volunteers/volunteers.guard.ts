import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { ChurchScopedRequest } from '../../common/interfaces/auth-user.interface'
import { SupabaseService } from '../../supabase/supabase.service'

const VOLUNTEER_PERMISSION = 'volunteer_permission'
type Permission = 'volunteers:read' | 'volunteers:*'
export const VolunteerPermission = (permission: Permission) =>
  SetMetadata(VOLUNTEER_PERMISSION, permission)

/** Runs after ChurchGuard has resolved the caller's membership. */
@Injectable()
export class VolunteersGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { membership } = context
      .switchToHttp()
      .getRequest<ChurchScopedRequest>()
    if (!membership || (membership.status ?? 'active') !== 'active')
      throw new ForbiddenException(
        'An active membership in this church is required'
      )

    const permission = this.reflector.getAllAndOverride<Permission>(
      VOLUNTEER_PERMISSION,
      [context.getHandler(), context.getClass()]
    )
    if (!permission) return true

    const { data, error } = await this.supabase.admin
      .from('role_permissions')
      .select('permissions')
      .eq('church_id', membership.churchId)
      .eq('role', membership.role)
      .maybeSingle()
    this.supabase.unwrap(data, error)
    if (
      !data?.permissions.includes(permission) &&
      !data?.permissions.includes('volunteers:*')
    )
      throw new ForbiddenException(
        'Insufficient volunteer permissions for this church'
      )
    return true
  }
}
