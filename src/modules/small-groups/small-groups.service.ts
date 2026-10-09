import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  CreateSmallGroupDto,
  UpdateSmallGroupDto,
} from './small-group.dto';

@Injectable()
export class SmallGroupsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from('small_groups')
      .select('*, small_group_members(id, membership_id)')
      .eq('church_id', churchId)
      .order('name');
    return this.supabase.unwrap(data ?? [], error);
  }

  async create(churchId: string, dto: CreateSmallGroupDto) {
    const { data, error } = await this.supabase.admin
      .from('small_groups')
      .insert({
        church_id: churchId,
        name: dto.name,
        description: dto.description,
        meeting_day: dto.meetingDay,
        meeting_time: dto.meetingTime,
        location: dto.location,
        leader_membership_id: dto.leaderMembershipId,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async update(churchId: string, groupId: string, dto: UpdateSmallGroupDto) {
    const { data, error } = await this.supabase.admin
      .from('small_groups')
      .update({
        name: dto.name,
        description: dto.description,
        meeting_day: dto.meetingDay,
        meeting_time: dto.meetingTime,
        location: dto.location,
        leader_membership_id: dto.leaderMembershipId,
      })
      .eq('church_id', churchId)
      .eq('id', groupId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async remove(churchId: string, groupId: string) {
    const { error } = await this.supabase.admin
      .from('small_groups')
      .delete()
      .eq('church_id', churchId)
      .eq('id', groupId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }

  async addMember(churchId: string, groupId: string, membershipId: string) {
    const { data, error } = await this.supabase.admin
      .from('small_group_members')
      .insert({ group_id: groupId, membership_id: membershipId })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async removeMember(churchId: string, groupId: string, membershipId: string) {
    const { error } = await this.supabase.admin
      .from('small_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('membership_id', membershipId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }
}