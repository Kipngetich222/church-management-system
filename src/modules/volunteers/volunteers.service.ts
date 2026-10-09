import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  CreateVolunteerRoleDto,
  CreateVolunteerShiftDto,
  UpdateVolunteerShiftDto,
} from './volunteer.dto';

@Injectable()
export class VolunteersService {
  constructor(private readonly supabase: SupabaseService) {}

  async listRoles(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from('volunteer_roles')
      .select('*')
      .eq('church_id', churchId)
      .order('name');
    return this.supabase.unwrap(data ?? [], error);
  }

  async createRole(churchId: string, dto: CreateVolunteerRoleDto) {
    const { data, error } = await this.supabase.admin
      .from('volunteer_roles')
      .insert({ church_id: churchId, name: dto.name, description: dto.description, color: dto.color })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async listShifts(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from('volunteer_shifts')
      .select('*, volunteer_roles(name, color), volunteer_signups(id, membership_id, status)')
      .eq('church_id', churchId)
      .order('starts_at', { ascending: true });
    return this.supabase.unwrap(data ?? [], error);
  }

  async createShift(churchId: string, dto: CreateVolunteerShiftDto, userId: string) {
    const { data, error } = await this.supabase.admin
      .from('volunteer_shifts')
      .insert({
        church_id: churchId,
        role_id: dto.roleId ?? null,
        title: dto.title,
        starts_at: dto.startsAt,
        ends_at: dto.endsAt,
        location: dto.location,
        slots: dto.slots ?? 1,
        notes: dto.notes,
        event_id: dto.eventId ?? null,
        created_by: userId,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async updateShift(churchId: string, shiftId: string, dto: UpdateVolunteerShiftDto) {
    const { data, error } = await this.supabase.admin
      .from('volunteer_shifts')
      .update({
        role_id: dto.roleId,
        title: dto.title,
        starts_at: dto.startsAt,
        ends_at: dto.endsAt,
        location: dto.location,
        slots: dto.slots,
        notes: dto.notes,
        event_id: dto.eventId,
      })
      .eq('church_id', churchId)
      .eq('id', shiftId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async removeShift(churchId: string, shiftId: string) {
    const { error } = await this.supabase.admin
      .from('volunteer_shifts')
      .delete()
      .eq('church_id', churchId)
      .eq('id', shiftId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }

  async signUp(churchId: string, shiftId: string, membershipId: string) {
    const { data, error } = await this.supabase.admin
      .from('volunteer_signups')
      .insert({ shift_id: shiftId, membership_id: membershipId, status: 'confirmed' })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async cancelSignUp(churchId: string, shiftId: string, membershipId: string) {
    const { error } = await this.supabase.admin
      .from('volunteer_signups')
      .delete()
      .eq('shift_id', shiftId)
      .eq('membership_id', membershipId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }
}