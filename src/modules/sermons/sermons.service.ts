import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CreateSermonDto, UpdateSermonDto } from './sermon.dto';

@Injectable()
export class SermonsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(churchId: string, publishedOnly = false) {
    let builder = this.supabase.admin
      .from('sermons')
      .select('*')
      .eq('church_id', churchId)
      .order('preached_at', { ascending: false });

    if (publishedOnly) builder = builder.eq('published', true);

    const { data, error } = await builder;
    return this.supabase.unwrap(data ?? [], error);
  }

  async getById(sermonId: string) {
    const { data, error } = await this.supabase.admin
      .from('sermons')
      .select('*, churches(id, name, slug, logo_url)')
      .eq('id', sermonId)
      .maybeSingle();
    const sermon = this.supabase.single(data, error);
    if (!sermon) throw new NotFoundException('Sermon not found');
    return sermon;
  }

  async create(churchId: string, dto: CreateSermonDto, userId: string) {
    const { data, error } = await this.supabase.admin
      .from('sermons')
      .insert({
        church_id: churchId,
        title: dto.title,
        speaker: dto.speaker,
        description: dto.description,
        youtube_id: dto.youtubeId,
        thumbnail_url: dto.thumbnailUrl,
        duration_seconds: dto.durationSeconds,
        series: dto.series,
        scripture_ref: dto.scriptureRef,
        preached_at: dto.preachedAt,
        tags: dto.tags ?? [],
        published: dto.published ?? true,
        created_by: userId,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async update(churchId: string, sermonId: string, dto: UpdateSermonDto) {
    const { data, error } = await this.supabase.admin
      .from('sermons')
      .update({
        title: dto.title,
        speaker: dto.speaker,
        description: dto.description,
        youtube_id: dto.youtubeId,
        thumbnail_url: dto.thumbnailUrl,
        duration_seconds: dto.durationSeconds,
        series: dto.series,
        scripture_ref: dto.scriptureRef,
        preached_at: dto.preachedAt,
        tags: dto.tags,
        published: dto.published,
      })
      .eq('church_id', churchId)
      .eq('id', sermonId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async remove(churchId: string, sermonId: string) {
    const { error } = await this.supabase.admin
      .from('sermons')
      .delete()
      .eq('church_id', churchId)
      .eq('id', sermonId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }
}