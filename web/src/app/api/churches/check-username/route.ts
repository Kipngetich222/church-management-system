import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import { validateChurchUsername } from '@/lib/utils/church-username'

/**
 * GET /api/churches/check-username?username=grace-chapel&exclude=<churchId>
 *
 * Public endpoint used while creating a church or editing the church profile to
 * tell the user whether a username is still available. Pass `exclude` to ignore
 * the church currently being edited.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const exclude = searchParams.get('exclude') ?? ''

  const validation = validateChurchUsername(searchParams.get('username') ?? '')
  if (!validation.valid) {
    return NextResponse.json({
      available: false,
      reason: 'invalid',
      message: validation.message,
    })
  }

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('churches')
    .select('id')
    .eq('username', validation.username)
    .limit(1)

  if (error) {
    console.error('Failed to check username availability:', error)
    return NextResponse.json(
      {
        available: false,
        reason: 'error',
        message: 'We could not check that username. Please try again.',
      },
      { status: 500 }
    )
  }

  const taken = (data ?? []).some((row) => row.id !== exclude)

  return NextResponse.json({
    available: !taken,
    reason: taken ? 'taken' : 'available',
    username: validation.username,
    message: taken
      ? 'That username is already taken. Try a different one.'
      : 'Username is available.',
  })
}
