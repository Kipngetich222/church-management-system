import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/utils/slug'

const bodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Church name must be at least 2 characters.')
    .max(120, 'Church name is too long.'),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
})

/**
 * Create a church and make the caller its super admin.
 *
 * Runs on the server with the service-role client so the AFTER INSERT triggers
 * that seed role permissions / expense categories are not blocked by RLS (the
 * caller is not an admin of the church yet at insert time).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Your session has expired. Please sign in again.' },
      { status: 401 }
    )
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          'Please check the form and try again.',
      },
      { status: 400 }
    )
  }

  const slug = slugify(parsed.data.slug?.trim() || parsed.data.name)
  if (!slug) {
    return NextResponse.json(
      { error: 'Please choose a valid church URL.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // The churches.created_by foreign key needs a matching profile row.
  if (user.email) {
    await admin
      .from('users')
      .upsert({ id: user.id, email: user.email }, { onConflict: 'id' })
  }

  const { data: existing } = await admin
    .from('churches')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'That church URL is already taken. Try a different one.' },
      { status: 409 }
    )
  }

  const { data: church, error: createError } = await admin
    .from('churches')
    .insert({
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      created_by: user.id,
      plan: 'basic',
    })
    .select('id')
    .single()

  if (createError || !church) {
    console.error('Failed to create church:', createError)
    return NextResponse.json(
      {
        error:
          'We could not create your church right now. Please try again in a moment.',
      },
      { status: 500 }
    )
  }

  const { error: memberError } = await admin.from('church_memberships').insert({
    user_id: user.id,
    church_id: church.id,
    role: 'super_admin',
  })

  if (memberError) {
    // Don't leave an orphaned church behind if the membership insert failed.
    await admin.from('churches').delete().eq('id', church.id)
    console.error('Failed to create church membership:', memberError)
    return NextResponse.json(
      {
        error:
          'We created your church but could not set you up as its admin. Please try again.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    churchId: church.id,
    role: 'super_admin',
    path: '/admin/dashboard?setup=1',
  })
}
