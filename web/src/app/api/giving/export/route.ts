import { givingCsv } from '../../../../../../src/modules/giving/giving-csv'
import {
  givingEngine,
  givingFailure,
  givingHistoryParams,
  givingUser,
} from '@/lib/services/giving.service'

export const maxDuration = 60
export async function GET(req: Request) {
  try {
    const user = await givingUser(),
      { churchId, scope, filters } = givingHistoryParams(req)
    const data = await givingEngine().exportHistory(
      user.id,
      churchId,
      scope,
      filters
    )
    const iterator = givingCsv(data.churchName, data.rows)
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const result = await iterator.next()
          if (result.done) controller.close()
          else controller.enqueue(encoder.encode(result.value))
        } catch (error) {
          controller.error(error)
        }
      },
      async cancel() {
        await iterator.return()
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="giving-${scope}-${churchId}.csv"`,
      },
    })
  } catch (error) {
    return givingFailure(error)
  }
}
