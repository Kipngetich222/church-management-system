import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { randomUUID } from 'crypto'
import { SupabaseService } from '../../supabase/supabase.service'
import { CreateResourceDto, UpdateResourceDto } from './resource.dto'
import {
  MAX_PHOTO_BYTES,
  MAX_RESOURCE_BYTES,
  RESOURCE_BUCKET,
  RESOURCE_MIME_TYPES,
  ResourceUploadFile,
} from './resource-files'

export { MAX_RESOURCE_BYTES } from './resource-files'
export type { ResourceUploadFile } from './resource-files'

@Injectable()
export class ResourcesService {
  private readonly logger = new Logger(ResourcesService.name)
  constructor(private readonly supabase: SupabaseService) {}

  async list(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from('resources')
      .select('*')
      .eq('church_id', churchId)
      .eq('active', true)
      .not('file_path', 'is', null)
      .order('created_at', { ascending: false })
    return this.supabase.unwrap(data ?? [], error)
  }

  async create(
    churchId: string,
    dto: CreateResourceDto,
    file?: ResourceUploadFile
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('Choose a non-empty file to upload')
    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? ''
    const mimeType = RESOURCE_MIME_TYPES[extension]
    if (
      typeof mimeType !== 'string' ||
      mimeType.startsWith('image/') !== (dto.type === 'image')
    ) {
      throw new BadRequestException(
        'Choose a supported file format matching the resource category'
      )
    }
    const limit = dto.type === 'image' ? MAX_PHOTO_BYTES : MAX_RESOURCE_BYTES
    if (file.size > limit || file.buffer.length > limit) {
      throw new BadRequestException(
        `File exceeds the ${dto.type === 'image' ? '10' : '50'} MB limit`
      )
    }
    if (file.originalname.length > 255)
      throw new BadRequestException('File name must be 255 characters or less')
    const path = `${churchId}/${randomUUID()}.${extension}`
    const storage = this.supabase.admin.storage.from(RESOURCE_BUCKET)
    const { error: uploadError } = await storage.upload(path, file.buffer, {
      contentType: mimeType,
      upsert: false,
    })
    if (uploadError) this.supabase.unwrap(null, uploadError)
    try {
      const { data, error } = await this.supabase.admin
        .from('resources')
        .insert({
          church_id: churchId,
          name: dto.name.trim(),
          type: dto.type,
          description: dto.description?.trim() || null,
          active: true,
          file_path: path,
          file_name: file.originalname,
          file_size: file.size,
          mime_type: mimeType,
          event_name:
            dto.type === 'image' ? dto.eventName?.trim() || null : null,
          photo_date: dto.type === 'image' ? dto.photoDate || null : null,
        })
        .select()
        .single()
      return this.supabase.unwrap(data, error)
    } catch (error) {
      const { error: cleanupError } = await storage.remove([path])
      if (cleanupError)
        this.logger.error(
          `Resource upload cleanup failed: ${cleanupError.message}`
        )
      throw error
    }
  }

  private async getResource(churchId: string, resourceId: string) {
    const { data, error } = await this.supabase.admin
      .from('resources')
      .select('*')
      .eq('church_id', churchId)
      .eq('id', resourceId)
      .eq('active', true)
      .not('file_path', 'is', null)
      .maybeSingle()
    if (error) this.supabase.unwrap(null, error)
    if (!data?.file_path || !data.file_name)
      throw new NotFoundException('Resource not found')
    return { ...data, file_path: data.file_path, file_name: data.file_name }
  }

  async fileUrl(churchId: string, resourceId: string, preview = false) {
    const resource = await this.getResource(churchId, resourceId)
    if (preview && resource.type !== 'image')
      throw new BadRequestException('Only photos can be previewed')
    const { data, error } = await this.supabase.admin.storage
      .from(RESOURCE_BUCKET)
      .createSignedUrl(
        resource.file_path,
        300,
        preview ? {} : { download: resource.file_name }
      )
    const result = this.supabase.unwrap(data, error)
    return { url: result.signedUrl, expiresIn: 300 }
  }

  async update(churchId: string, resourceId: string, dto: UpdateResourceDto) {
    await this.getResource(churchId, resourceId)
    const { data, error } = await this.supabase.admin
      .from('resources')
      .update({
        name: dto.name?.trim(),
        type: dto.type,
        description: dto.description?.trim(),
        event_name: dto.eventName?.trim(),
        photo_date: dto.photoDate,
      })
      .eq('church_id', churchId)
      .eq('id', resourceId)
      .select()
      .single()
    return this.supabase.unwrap(data, error)
  }

  async remove(churchId: string, resourceId: string) {
    const resource = await this.getResource(churchId, resourceId)
    const { error: storageError } = await this.supabase.admin.storage
      .from(RESOURCE_BUCKET)
      .remove([resource.file_path])
    if (storageError) this.supabase.unwrap(null, storageError)
    // Keep the row when storage removal fails, allowing the admin to retry.
    const { data, error } = await this.supabase.admin
      .from('resources')
      .delete()
      .eq('church_id', churchId)
      .eq('id', resourceId)
      .select('id')
      .single()
    this.supabase.unwrap(data, error)
    return { success: true }
  }
}
