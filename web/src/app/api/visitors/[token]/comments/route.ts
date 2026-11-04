import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import {
  visitorCommentSchema,
  visitorCookieName,
  visitorTokenSchema,
} from '@/lib/visitors'
import {
  rejectCrossOrigin,
  visitorSessionErrorResponse,
} from '@/lib/services/visitors.service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const blocked = rejectCrossOrigin(request)
  if (blocked) return blocked
  const { token } = await params
  if (!visitorTokenSchema.safeParse(token).success)
    return NextResponse.json(
      { error: 'Invalid welcome link.' },
      { status: 404 }
    )
  const session = (await cookies()).get(visitorCookieName(token))?.value
  if (!session)
    return visitorSessionErrorResponse({
      code: '42501',
      message: 'Missing visitor session',
    })
  const parsed = visitorCommentSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid comment.' },
      { status: 400 }
    )
  const { data, error } = await createPublicClient().rpc(
    'add_visitor_comment',
    {
      p_token: token,
      p_session_token: session,
      p_body: parsed.data.body,
      p_submission_id: parsed.data.submissionId,
    }
  )
  if (error) return visitorSessionErrorResponse(error)
  revalidatePath('/admin/visitors')
  revalidatePath(`/visit/${token}`)
  return NextResponse.json(
    { id: data },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
