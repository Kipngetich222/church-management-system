import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CreateVisitorDto, FollowUpDto, UpdateVisitorDto } from './visitor.dto';

@Injectable()
export class VisitorsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(churchId: string, status?: string) {
    let builder = this.supabase.admin
      .from('visitors')
      .select('*')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false });
    if (status) builder = builder.eq('status', status);
    const { data, error } = await builder;
    return this.supabase.unwrap(data ?? [], error);
  }

  async getOne(churchId: string, visitorId: string) {
    const { data, error } = await this.supabase.admin
      .from('visitors')
      .select('*, visitor_followups(*)')
      .eq('church_id', churchId)
      .eq('id', visitorId)
      .maybeSingle();
    const visitor = this.supabase.single(data, error);
    if (!visitor) throw new NotFoundException('Visitor not found');
    return visitor;
  }

  async create(churchId: string, dto: CreateVisitorDto) {
    const { data, error } = await this.supabase.admin
      .from('visitors')
      .insert({
        church_id: churchId,
        full_name: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        first_visit_date: dto.firstVisitDate,
        invited_by_membership_id: dto.invitedByMembershipId ?? null,
        notes: dto.notes,
        status: dto.status ?? 'new',
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async update(churchId: string, visitorId: string, dto: UpdateVisitorDto) {
    const { data, error } = await this.supabase.admin
      .from('visitors')
      .update({
        full_name: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        first_visit_date: dto.firstVisitDate,
        notes: dto.notes,
        status: dto.status,
        updated_at: new Date().toISOString(),
      })
      .eq('church_id', churchId)
      .eq('id', visitorId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async remove(churchId: string, visitorId: string) {
    const { error } = await this.supabase.admin
      .from('visitors')
      .delete()
      .eq('church_id', churchId)
      .eq('id', visitorId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }

  async addFollowUp(
    churchId: string,
    visitorId: string,
    membershipId: string,
    dto: FollowUpDto,
  ) {
    const { data, error } = await this.supabase.admin
      .from('visitor_followups')
      .insert({
        visitor_id: visitorId,
        author_membership_id: membershipId,
        method: dto.method,
        notes: dto.notes,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }
}