import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CreateBookingDto, CreateResourceDto, UpdateResourceDto } from './resource.dto';

@Injectable()
export class ResourcesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from('resources')
      .select('*')
      .eq('church_id', churchId)
      .order('name');
    return this.supabase.unwrap(data ?? [], error);
  }

  async create(churchId: string, dto: CreateResourceDto) {
    const { data, error } = await this.supabase.admin
      .from('resources')
      .insert({
        church_id: churchId,
        name: dto.name,
        type: dto.type,
        capacity: dto.capacity,
        location: dto.location,
        description: dto.description,
        active: dto.active ?? true,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async update(churchId: string, resourceId: string, dto: UpdateResourceDto) {
    const { data, error } = await this.supabase.admin
      .from('resources')
      .update({ ...dto })
      .eq('church_id', churchId)
      .eq('id', resourceId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async remove(churchId: string, resourceId: string) {
    const { error } = await this.supabase.admin
      .from('resources')
      .delete()
      .eq('church_id', churchId)
      .eq('id', resourceId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }

  async listBookings(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from('resource_bookings')
      .select('*, resources(name, type), church_memberships(id, users(full_name, email))')
      .eq('church_id', churchId)
      .order('starts_at', { ascending: false });
    return this.supabase.unwrap(data ?? [], error);
  }

  async createBooking(churchId: string, dto: CreateBookingDto, membershipId: string) {
    const { data, error } = await this.supabase.admin
      .from('resource_bookings')
      .insert({
        church_id: churchId,
        resource_id: dto.resourceId,
        membership_id: membershipId,
        title: dto.title,
        purpose: dto.purpose,
        starts_at: dto.startsAt,
        ends_at: dto.endsAt,
        status: 'pending',
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async updateBookingStatus(churchId: string, bookingId: string, status: string, userId: string) {
    const { data, error } = await this.supabase.admin
      .from('resource_bookings')
      .update({ status, approved_by: userId })
      .eq('church_id', churchId)
      .eq('id', bookingId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async removeBooking(churchId: string, bookingId: string) {
    const { error } = await this.supabase.admin
      .from('resource_bookings')
      .delete()
      .eq('church_id', churchId)
      .eq('id', bookingId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }
}