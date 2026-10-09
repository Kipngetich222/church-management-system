import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { CreateAnnouncementDto, UpdateAnnouncementDto } from "./announcement.dto";

@Injectable()
export class AnnouncementsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(churchId: string, publishedOnly = true) {
    let builder = this.supabase.admin
      .from("announcements")
      .select("*")
      .eq("church_id", churchId)
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false });

    if (publishedOnly) builder = builder.eq("published", true);

    const { data, error } = await builder;
    return this.supabase.unwrap(data ?? [], error);
  }

  async create(churchId: string, dto: CreateAnnouncementDto, userId: string) {
    const { data, error } = await this.supabase.admin
      .from("announcements")
      .insert({
        church_id: churchId,
        title: dto.title,
        body: dto.body,
        pinned: dto.pinned ?? false,
        published: dto.published ?? true,
        published_at: new Date().toISOString(),
        created_by: userId,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async update(churchId: string, announcementId: string, dto: UpdateAnnouncementDto) {
    const { data, error } = await this.supabase.admin
      .from("announcements")
      .update({
        title: dto.title,
        body: dto.body,
        pinned: dto.pinned,
        published: dto.published,
      })
      .eq("church_id", churchId)
      .eq("id", announcementId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async remove(churchId: string, announcementId: string) {
    const { error } = await this.supabase.admin
      .from("announcements")
      .delete()
      .eq("church_id", churchId)
      .eq("id", announcementId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }
}