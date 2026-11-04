import { z } from 'zod'
import {
  isValidPhone,
  normalizePhone,
  PHONE_VALIDATION_MESSAGE,
} from '@/lib/phone'
import type { Database } from '@/types/database'
import type { ServiceTime } from '@/lib/constants/services'

export type VisitorPortalSettings =
  Database['public']['Tables']['visitor_portals']['Row']
export type VisitorComment = Pick<
  Database['public']['Tables']['visitor_comments']['Row'],
  'id' | 'body' | 'created_at'
>
export type VisitorWelcome = {
  church_id: string
  church_name: string
  church_username: string
  logo_url: string | null
  welcome_message: string
}
export type VisitorPortalContent = {
  visitor: { full_name: string }
  comments: VisitorComment[]
  events: {
    id: string
    title: string
    description: string | null
    start_time: string
    end_time: string | null
    location_name: string | null
  }[]
  services: {
    id: string
    title: string
    description: string | null
    day_of_week: number
    times: ServiceTime[]
    timezone: string
    location_name: string | null
  }[]
}

export const visitorContactSchema = z.object({
  full_name: z.string().trim().min(1, 'Enter your full name.').max(160),
  phone: z
    .string()
    .trim()
    .max(40)
    .default('')
    .refine((value) => !value || isValidPhone(value), PHONE_VALIDATION_MESSAGE)
    .transform((value) => (value ? normalizePhone(value) : '')),
  email: z
    .string()
    .trim()
    .max(254)
    .default('')
    .refine(
      (value) => !value || z.email().safeParse(value).success,
      'Enter a valid email address.'
    )
    .transform((value) => value.toLowerCase()),
})

export const manualVisitorSchema = visitorContactSchema.extend({
  first_visit_date: z.union([z.literal(''), z.iso.date()]),
  notes: z.string().trim().max(5000).default(''),
})

export const visitorRegistrationSchema = visitorContactSchema
  .extend({
    comment: z.string().trim().max(2000).default(''),
    registrationToken: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()

export const visitorCommentSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'Enter a comment.')
      .max(2000, 'Comments can contain up to 2000 characters.'),
    submissionId: z.uuid(),
  })
  .strict()

export const visitorWelcomeSchema = z
  .object({
    welcome_message: z
      .string()
      .trim()
      .min(1, 'Enter a welcome message.')
      .max(2000),
  })
  .strict()

export const visitorTokenSchema = z.uuid()
export const VISITOR_SESSION_SECONDS = 30 * 24 * 60 * 60
export function visitorCookieName(token: string) {
  return `church_visitor_${token.replaceAll('-', '').toLowerCase()}`
}

export function newVisitorSessionToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

type CommentSubmission = z.infer<typeof visitorCommentSchema>

export function visitorCommentSubmission(
  body: string,
  previous?: CommentSubmission | null
): CommentSubmission {
  const trimmed = body.trim()
  if (previous?.body === trimmed) return previous
  // getRandomValues also works on local HTTP devices, unlike randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
  const submissionId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  return { body: trimmed, submissionId }
}
