import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { updateMemberProfile } from '@/lib/services/members.service'
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/phone'

/**
 * Update a member's profile.
 *
 * Used by both a member editing their own profile and an admin editing a member.
 * Writes go through the service-role client so they are not blocked by RLS (see
 * updateMemberProfile); authorization is enforced in the service - the caller
 * must own the membership or be an admin of its church.
 */
const bodySchema = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  phone: z
    .string()
    .trim()
    .refine((value) => isValidPhone(value), {
      message: PHONE_VALIDATION_MESSAGE,
    })
    .nullish(),
  date_of_birth: z
    .string()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: 'Date of birth must be a valid date (YYYY-MM-DD)',
    })
    .nullish(),
  gender: z.string().trim().max(40).nullish(),
  category: z.enum(['men', 'women', 'youth']).nullish(),
  address: z.string().trim().max(300).nullish(),
  badges: z.array(z.string()).optional(),
  is_baptized: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  try {
    const result = await updateMemberProfile({
      actorId: user.id,
      membershipId: memberId,
      input: parsed.data,
    })

    if (result.status === 'not_found') {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    if (result.status === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Could not update profile' },
      { status: 400 }
    )
  }
}
