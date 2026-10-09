import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { slugify } from '../../common/utils/slug';
import {
  CreateEventDto,
  MarkAttendanceDto,
  QueryEventsDto,
  RegisterEventDto,
  UpdateEventDto,
} from './event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(churchId: string, query: QueryEventsDto = {}) {
    let builder = this.supabase.admin
      .from('events')
      .select('*')
      .eq('church_id', churchId)
      .order('start_time', { ascending: true });

    if (query.from) builder = builder.gte('start_time', query.from);
    if (query.to) builder = builder.lte('start_time', query.to);
    if (query.status) builder = builder.eq('status', query.status);
    if (query.visibility) builder = builder.eq('visibility', query.visibility);

    const { data, error } = await builder;
    return this.supabase.unwrap(data ?? [], error);
  }

  async upcomingPublic(limit = 10) {
    const { data, error } = await this.supabase.admin
      .from('events')
      .select('*, churches(id, name, slug, logo_url)')
      .eq('visibility', 'public')
      .eq('status', 'published')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(limit);
    return this.supabase.unwrap(data ?? [], error);
  }

  async getById(eventId: string) {
    const { data, error } = await this.supabase.admin
      .from('events')
      .select('*, churches(id, name, slug, logo_url)')
      .eq('id', eventId)
      .maybeSingle();
    const event = this.supabase.single(data, error);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async create(churchId: string, dto: CreateEventDto, userId: string) {
    const { data, error } = await this.supabase.admin
      .from('events')
      .insert({
        church_id: churchId,
        title: dto.title,
        slug: `${slugify(dto.title)}-${Date.now().toString(36)}`,
        description: dto.description,
        start_time: dto.startTime,
        end_time: dto.endTime,
        all_day: dto.allDay ?? false,
        location_name: dto.locationName,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        poster_url: dto.posterUrl,
        capacity: dto.capacity,
        status: dto.status ?? 'published',
        visibility: dto.visibility ?? 'public',
        is_registration_required: dto.isRegistrationRequired ?? false,
        registration_deadline: dto.registrationDeadline,
        price: dto.price ?? 0,
        currency: dto.currency ?? 'KES',
        created_by: userId,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async update(churchId: string, eventId: string, dto: UpdateEventDto) {
    const { data, error } = await this.supabase.admin
      .from('events')
      .update({
        title: dto.title,
        description: dto.description,
        start_time: dto.startTime,
        end_time: dto.endTime,
        all_day: dto.allDay,
        location_name: dto.locationName,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        poster_url: dto.posterUrl,
        capacity: dto.capacity,
        status: dto.status,
        visibility: dto.visibility,
        is_registration_required: dto.isRegistrationRequired,
        registration_deadline: dto.registrationDeadline,
        price: dto.price,
        currency: dto.currency,
      })
      .eq('church_id', churchId)
      .eq('id', eventId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async remove(churchId: string, eventId: string) {
    const { error } = await this.supabase.admin
      .from('events')
      .delete()
      .eq('church_id', churchId)
      .eq('id', eventId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }

  async register(eventId: string, dto: RegisterEventDto, userId?: string) {
    const admin = this.supabase.admin;
    const { data: event } = await admin
      .from('events')
      .select('id, church_id, status, capacity, registration_deadline, price')
      .eq('id', eventId)
      .maybeSingle();

    if (!event || event.status !== 'published') {
      throw new NotFoundException('Event not available');
    }

    if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
      throw new BadRequestException('Registration is closed');
    }

    const { count } = await admin
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (event.capacity && (count ?? 0) >= event.capacity) {
      throw new BadRequestException('Event is full');
    }

    let membershipId: string | null = null;
    if (userId) {
      const { data: membership } = await admin
        .from('church_memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('church_id', event.church_id)
        .maybeSingle();
      membershipId = membership?.id ?? null;
    }

    const { data, error } = await admin
      .from('event_registrations')
      .insert({
        event_id: eventId,
        user_id: userId ?? null,
        church_membership_id: membershipId,
        guest_name: dto.name,
        guest_email: dto.email,
        guest_phone: dto.phone ?? null,
        status: 'registered',
        payment_status: Number(event.price ?? 0) > 0 ? 'pending' : 'free',
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async listRegistrations(churchId: string, eventId: string) {
    const { data, error } = await this.supabase.admin
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    return this.supabase.unwrap(data ?? [], error);
  }

  async listAttendance(eventId: string) {
    const { data, error } = await this.supabase.admin
      .from('event_attendance')
      .select('*, church_memberships(id, users(full_name, email))')
      .eq('event_id', eventId)
      .order('scanned_at', { ascending: false });
    return this.supabase.unwrap(data ?? [], error);
  }

  async markAttendance(eventId: string, dto: MarkAttendanceDto, method = 'manual') {
    const { data, error } = await this.supabase.admin
      .from('event_attendance')
      .insert({
        event_id: eventId,
        membership_id: dto.membershipId ?? null,
        registration_id: dto.registrationId ?? null,
        method,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }
}