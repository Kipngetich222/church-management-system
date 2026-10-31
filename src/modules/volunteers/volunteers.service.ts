import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { SupabaseService } from '../../supabase/supabase.service'
import {
  CreateVolunteerRoleDto,
  CreateVolunteerShiftDto,
  UpdateVolunteerShiftDto,
} from './volunteer.dto'
import type { Database } from '../../types/database'

@Injectable()
export class VolunteersService {
  constructor(private readonly supabase: SupabaseService) {}

  private result<T>(
    data: T,
    error: { code?: string; message: string } | null
  ): T {
    if (error?.code === '23505')
      throw new ConflictException(
        'You have already signed up for this activity'
      )
    if (
      error &&
      ['23514', '23503', '23502', '22007', '22008', '22P02'].includes(
        error.code ?? ''
      )
    )
      throw new BadRequestException(error.message)
    return this.supabase.unwrap(data, error)
  }

  async listRoles(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from('volunteer_roles')
      .select('*')
      .eq('church_id', churchId)
      .order('name')
    return this.supabase.unwrap(data ?? [], error)
  }

  async createRole(churchId: string, dto: CreateVolunteerRoleDto) {
    const { data, error } = await this.supabase.admin
      .from('volunteer_roles')
      .insert({
        church_id: churchId,
        name: dto.name.trim(),
        description: dto.description,
        color: dto.color,
      })
      .select()
      .single()
    return this.supabase.unwrap(data, error)
  }

  async listShifts(churchId: string, authorization: string) {
    const client = this.supabase.forUser(
      authorization.replace(/^Bearer\s+/i, '')
    )
    const activities: Database['public']['Functions']['get_volunteer_activities']['Returns'] =
      []
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client
        .rpc('get_volunteer_activities', { p_church_id: churchId })
        .order('id')
        .range(offset, offset + 99)
      this.supabase.unwrap(data, error)
      activities.push(...(data ?? []))
      if (!data || data.length < 100) break
    }
    return activities
  }

  private async getShift(churchId: string, shiftId: string) {
    const { data, error } = await this.supabase.admin
      .from('volunteer_shifts')
      .select('*')
      .eq('church_id', churchId)
      .eq('id', shiftId)
      .maybeSingle()
    this.supabase.unwrap(data, error)
    if (!data) throw new NotFoundException('Activity not found in this church')
    return data
  }

  private payload(dto: UpdateVolunteerShiftDto) {
    return {
      role_id: dto.roleId,
      title: dto.title?.trim(),
      starts_at: dto.startsAt,
      ends_at: dto.endsAt,
      location: dto.location?.trim(),
      slots: dto.slots,
      notes: dto.notes,
      event_id: dto.eventId,
      category: dto.category,
      recurrence: dto.recurrence,
      recurrence_until: dto.recurrence === 'none' ? null : dto.recurrenceUntil,
      timezone: dto.timezone,
      is_active: dto.isActive,
    }
  }

  async createShift(
    churchId: string,
    dto: CreateVolunteerShiftDto,
    userId: string
  ) {
    const { data, error } = await this.supabase.admin
      .from('volunteer_shifts')
      .insert({
        ...this.payload(dto),
        church_id: churchId,
        title: dto.title.trim(),
        starts_at: dto.startsAt,
        ends_at: dto.endsAt,
        created_by: userId,
      })
      .select()
      .single()
    return this.result(data, error)
  }

  async updateShift(
    churchId: string,
    shiftId: string,
    dto: UpdateVolunteerShiftDto
  ) {
    await this.getShift(churchId, shiftId)
    const { data, error } = await this.supabase.admin
      .from('volunteer_shifts')
      .update(this.payload(dto))
      .eq('church_id', churchId)
      .eq('id', shiftId)
      .select()
      .single()
    return this.result(data, error)
  }

  async removeShift(churchId: string, shiftId: string) {
    await this.getShift(churchId, shiftId)
    const { error } = await this.supabase.admin
      .from('volunteer_shifts')
      .delete()
      .eq('church_id', churchId)
      .eq('id', shiftId)
    this.supabase.unwrap(null, error)
    return { success: true }
  }

  async listParticipants(churchId: string, shiftId: string) {
    await this.getShift(churchId, shiftId)
    const query = () =>
      this.supabase.admin
        .from('volunteer_signups')
        .select(
          'id, status, signed_up_at, membership_id, church_memberships(full_name, email, phone, users!church_memberships_user_id_fkey(full_name, email, phone))'
        )
        .eq('shift_id', shiftId)
        .order('id')
    const first = await query().range(0, 99)
    this.supabase.unwrap(first.data, first.error)
    const rows = first.data ?? []
    if (rows.length === 100) {
      for (let offset = 100; ; offset += 100) {
        const { data, error } = await query().range(offset, offset + 99)
        this.supabase.unwrap(data, error)
        rows.push(...(data ?? []))
        if (!data || data.length < 100) break
      }
    }
    return rows
  }

  async signUp(churchId: string, shiftId: string, membershipId: string) {
    await this.getShift(churchId, shiftId)
    const cancelled = await this.supabase.admin
      .from('volunteer_signups')
      .delete()
      .eq('shift_id', shiftId)
      .eq('membership_id', membershipId)
      .eq('status', 'cancelled')
    this.supabase.unwrap(null, cancelled.error)
    const { data, error } = await this.supabase.admin
      .from('volunteer_signups')
      .insert({
        shift_id: shiftId,
        membership_id: membershipId,
        status: 'confirmed',
      })
      .select()
      .single()
    return this.result(data, error)
  }

  async cancelSignUp(churchId: string, shiftId: string, membershipId: string) {
    await this.getShift(churchId, shiftId)
    const { error } = await this.supabase.admin
      .from('volunteer_signups')
      .delete()
      .eq('shift_id', shiftId)
      .eq('membership_id', membershipId)
    this.supabase.unwrap(null, error)
    return { success: true }
  }
}
