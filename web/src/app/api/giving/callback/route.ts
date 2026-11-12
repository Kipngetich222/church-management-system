import {
  givingEngine,
  givingFailure,
  givingJson,
} from '@/lib/services/giving.service'

export const maxDuration = 60
export async function POST(req: Request) {
  try {
    const params = new URL(req.url).searchParams
    return givingJson(
      await givingEngine().handleCallback(
        params.get('id') ?? '',
        params.get('token') ?? '',
        await req.json()
      )
    )
  } catch (error) {
    return givingFailure(error)
  }
}
