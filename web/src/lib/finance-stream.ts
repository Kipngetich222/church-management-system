/** Stream every row; a failed page errors the download instead of returning a truncated file. */
export function financeCsvResponse(
  iterator: AsyncGenerator<string>,
  filename: string
) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next()
        if (next.done) controller.close()
        else controller.enqueue(encoder.encode(next.value))
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return(undefined)
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
