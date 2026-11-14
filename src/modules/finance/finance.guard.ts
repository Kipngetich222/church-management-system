import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { Request } from 'express'
import type { ChurchScopedRequest } from '../../common/interfaces/auth-user.interface'
import { SupabaseService } from '../../supabase/supabase.service'

@Injectable()
export class FinanceGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}
  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & ChurchScopedRequest>()
    const member = request.membership
    if (!member || member.status !== 'active')
      throw new ForbiddenException('An active church membership is required.')
    if (['myGiving', 'listCampaigns'].includes(context.getHandler().name))
      return true
    const required = ['GET', 'HEAD'].includes(request.method)
      ? 'finance:read'
      : 'finance:write'
    const { data, error } = await this.supabase.admin
      .from('role_permissions')
      .select('permissions')
      .eq('church_id', member.churchId)
      .eq('role', member.role)
      .maybeSingle()
    if (
      error ||
      !['super_admin', 'dept_admin'].includes(member.role) ||
      !(data?.permissions ?? []).some(
        (permission) => permission === 'finance:*' || permission === required
      )
    )
      throw new ForbiddenException(
        'Finance permission is required for this action.'
      )
    return true
  }
}
