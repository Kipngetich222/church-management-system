import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { SupabaseService } from '../../supabase/supabase.service'
import type { MembershipSummary } from '../../common/interfaces/auth-user.interface'
import {
  CreatePrayerRequestDto,
  PrayerInteractionDto,
  UpdatePrayerRequestDto,
} from './prayer-request.dto'

const PRAYER_RETENTION_DAYS = 7

function prayerCutoff() {
  return new Date(
    Date.now() - PRAYER_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
}

@Injectable()
export class PrayerRequestsService {
  constructor(private readonly supabase: SupabaseService) {}

  private isAdmin(membership: MembershipSummary) {
    return membership.role === 'super_admin' || membership.role === 'dept_admin'
  }

  private canView(request: any, membership: MembershipSummary) {
    if (this.isAdmin(membership)) return true
    if (request.membership_id === membership.id) return true
    if (request.assigned_to === membership.id) return true
    return false
  }

  private canManage(request: any, membership: MembershipSummary) {
    return this.canView(request, membership)
  }

  private async assertAssigneeInChurch(churchId: string, assignedTo: string) {
    const { data: target, error } = await this.supabase.admin
      .from('church_memberships')
      .select('id')
      .eq('id', assignedTo)
      .eq('church_id', churchId)
      .maybeSingle()

    if (error) this.supabase.unwrap(null, error)
    if (!target) {
      throw new BadRequestException(
        'The selected pastor or leader is not a member of this church.'
      )
    }
  }

  async list(
    churchId: string,
    membership: MembershipSummary,
    status?: string,
    type?: string,
    assignedToMe?: boolean
  ) {
    let builder = this.supabase.admin
      .from('prayer_requests')
      .select(
        '*, church_memberships!prayer_requests_membership_id_fkey(id, users!church_memberships_user_id_fkey(full_name, avatar_url)), prayer_interactions(id)'
      )
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })

    if (status) builder = builder.eq('status', status as any)
    if (type) builder = builder.eq('type', type as any)
    if (assignedToMe) builder = builder.eq('assigned_to', membership.id)

    if (!this.isAdmin(membership)) {
      builder = builder.or(
        `membership_id.eq.${membership.id},assigned_to.eq.${membership.id},visibility.eq.public_anonymous,visibility.eq.public_named,and(type.eq.prayer,audience.eq.church)`
      )
    }

    const { data, error } = await builder
    const rows = this.supabase.unwrap(data ?? [], error) as any[]
    const cutoff = prayerCutoff()

    if (!this.isAdmin(membership)) {
      for (const row of rows) {
        if (
          row.visibility === 'public_anonymous' &&
          row.membership_id !== membership.id &&
          row.assigned_to !== membership.id
        ) {
          row.church_memberships = null
        }
      }
    }

    if (status) return rows

    return rows.filter((request) => {
      if (request.type === 'counseling') {
        return request.status === 'open' || request.status === 'in_progress'
      }

      return (
        !request.archived_at &&
        request.created_at >= cutoff &&
        (request.status === 'open' || request.status === 'in_progress')
      )
    })
  }

  async create(
    churchId: string,
    membership: MembershipSummary,
    dto: CreatePrayerRequestDto
  ) {
    const type = dto.type ?? 'prayer'
    const audience =
      type === 'counseling' ? 'person' : (dto.audience ?? 'leaders')

    if (audience === 'person' && !dto.assignedTo) {
      throw new BadRequestException(
        type === 'counseling'
          ? 'Choose the pastor or leader you would like to speak with.'
          : 'Choose the pastor or leader you would like to send this to.'
      )
    }

    if (dto.assignedTo) {
      await this.assertAssigneeInChurch(churchId, dto.assignedTo)
    }

    const visibility =
      type === 'counseling' || audience === 'person'
        ? 'pastors_only'
        : (dto.visibility ?? 'pastors_only')

    const { data, error } = await this.supabase.admin
      .from('prayer_requests')
      .insert({
        church_id: churchId,
        membership_id: membership.id,
        type,
        category: dto.category,
        title: dto.title,
        body: dto.body,
        audience,
        assigned_to: audience === 'person' ? dto.assignedTo : null,
        visibility,
        status: 'open',
      })
      .select()
      .single()
    return this.supabase.unwrap(data, error)
  }

  async getOne(
    churchId: string,
    requestId: string,
    membership: MembershipSummary
  ) {
    const { data, error } = await this.supabase.admin
      .from('prayer_requests')
      .select(
        '*, assigned_membership:church_memberships!prayer_requests_assigned_to_fkey(id, users!church_memberships_user_id_fkey(full_name)), church_memberships!prayer_requests_membership_id_fkey(id, users!church_memberships_user_id_fkey(full_name, avatar_url)), prayer_interactions(*)'
      )
      .eq('church_id', churchId)
      .eq('id', requestId)
      .maybeSingle()
    const request = this.supabase.single(data, error)
    if (!request) throw new NotFoundException('Prayer request not found')

    const isChurchPrayer =
      request.type === 'prayer' &&
      request.audience === 'church' &&
      !request.archived_at &&
      new Date(request.created_at ?? 0) >= new Date(prayerCutoff()) &&
      (request.status === 'open' || request.status === 'in_progress')

    if (!this.canView(request, membership) && !isChurchPrayer) {
      throw new ForbiddenException('You cannot view this prayer request')
    }

    if (
      !this.isAdmin(membership) &&
      request.visibility === 'public_anonymous' &&
      request.membership_id !== membership.id &&
      request.assigned_to !== membership.id
    ) {
      const sanitized = request as any
      sanitized.church_memberships = null
    }

    return request
  }

  async update(
    churchId: string,
    requestId: string,
    membership: MembershipSummary,
    dto: UpdatePrayerRequestDto
  ) {
    const existing = await this.getOne(churchId, requestId, membership)
    if (
      !this.isAdmin(membership) &&
      existing.membership_id !== membership.id &&
      existing.assigned_to !== membership.id
    ) {
      throw new ForbiddenException('You cannot edit this prayer request')
    }

    const nextType = dto.type ?? existing.type
    let nextAudience = dto.audience ?? existing.audience
    if (nextType === 'counseling') nextAudience = 'person'

    const nextAssignedTo =
      dto.assignedTo !== undefined ? dto.assignedTo : existing.assigned_to

    if (nextAudience === 'person') {
      if (!nextAssignedTo) {
        throw new BadRequestException(
          nextType === 'counseling'
            ? 'Choose the pastor or leader who should handle this counselling request.'
            : 'Choose the pastor or leader you would like to send this to.'
        )
      }
      if (dto.assignedTo) {
        await this.assertAssigneeInChurch(churchId, dto.assignedTo)
      }
    }

    if (nextType === 'counseling' && dto.status === 'answered') {
      throw new BadRequestException(
        'Counselling requests can be closed, but not marked as answered.'
      )
    }

    const nextVisibility =
      nextType === 'counseling' || nextAudience === 'person'
        ? 'pastors_only'
        : (dto.visibility ?? existing.visibility)

    const closing = dto.status === 'closed' || dto.status === 'answered'

    const { data, error } = await this.supabase.admin
      .from('prayer_requests')
      .update({
        type: nextType,
        audience: nextAudience,
        assigned_to: nextAudience === 'person' ? nextAssignedTo : null,
        category: dto.category,
        title: dto.title,
        body: dto.body,
        visibility: nextVisibility,
        status: dto.status,
        closed_at: closing
          ? new Date().toISOString()
          : dto.status
            ? null
            : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('church_id', churchId)
      .eq('id', requestId)
      .select()
      .single()
    return this.supabase.unwrap(data, error)
  }

  async addInteraction(
    churchId: string,
    requestId: string,
    membership: MembershipSummary,
    dto: PrayerInteractionDto
  ) {
    const request = await this.getOne(churchId, requestId, membership)
    if (!this.canManage(request, membership)) {
      throw new ForbiddenException(
        'You cannot add a note to this prayer request'
      )
    }
    const { data, error } = await this.supabase.admin
      .from('prayer_interactions')
      .insert({
        request_id: requestId,
        author_membership_id: membership.id,
        body: dto.body,
        is_internal: this.isAdmin(membership)
          ? (dto.isInternal ?? false)
          : false,
      })
      .select()
      .single()
    return this.supabase.unwrap(data, error)
  }
}
