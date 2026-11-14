import {
  financeEngine,
  financeFailure,
  financeUser,
} from '@/lib/services/finance.service'
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await financeUser(),
      { id } = await context.params
    const url = await financeEngine().documentUrl(
      user.id,
      new URL(req.url).searchParams.get('churchId') ?? '',
      id
    )
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch (error) {
    return financeFailure(error)
  }
}
