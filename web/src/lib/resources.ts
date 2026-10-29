import type { Database } from '@/types/database'

export const RESOURCE_BUCKET = 'church-resources'
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
export const RESOURCE_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  txt: 'text/plain',
  rtf: 'application/rtf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}
export const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif'
export const DOCUMENT_ACCEPT =
  '.pdf,.epub,.doc,.docx,.odt,.txt,.rtf,.ppt,.pptx,.xls,.xlsx'

export type LibraryResource =
  Database['public']['Tables']['resources']['Row'] & {
    file_path: string
    file_name: string
    file_size: number
    mime_type: string
  }

export function fileSizeLabel(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function resourceFileUrl(
  resource: Pick<LibraryResource, 'id' | 'church_id'>,
  preview = false
) {
  return `/api/resources/${resource.id}/file?churchId=${encodeURIComponent(resource.church_id)}${preview ? '&preview=1' : ''}`
}
