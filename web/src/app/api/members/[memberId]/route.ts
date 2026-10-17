import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  deleteMember,
  updateMemberProfile,
} from '@/lib/services/members.service'
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/phone'

const emailSchema = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) => value === '' || z.string().email().safeParse(value).success,
    { message: 'Enter a valid email address.' }
  )

const bodySchema = z.object({
  full_name: z.string().trim().min(1).max(160).optional(),
  email: emailSchema.nullish(),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || isValidPhone(value), {
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
  category: z.enum(['men', 'women', 'youth', 'children']).nullish(),
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

    revalidatePath('/admin/members')
    revalidatePath(`/admin/members/${memberId}`)
    revalidatePath('/admin/members/badges')
    revalidatePath('/member/profile')
    revalidatePath('/member/home')
    revalidatePath(`/members/${memberId}`)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Could not update profile' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  _req: Request,
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

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('church_id')
    .eq('id', memberId)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  try {
    const result = await deleteMember({
      actorId: user.id,
      churchId: membership.church_id,
      membershipId: memberId,
    })

    if (result.status === 'not_found') {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    if (result.status === 'forbidden') {
      return NextResponse.json(
        { error: 'Only a super admin can delete a member.' },
        { status: 403 }
      )
    }
    if (result.status === 'self') {
      return NextResponse.json(
        { error: 'You cannot delete your own membership.' },
        { status: 400 }
      )
    }

    revalidatePath('/admin/members')
    revalidatePath('/admin/members/badges')

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Could not delete member' },
      { status: 400 }
    )
  }
}
