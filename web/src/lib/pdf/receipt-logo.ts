import sharp from 'sharp'

/** Fetch only this church's uploaded asset, never an arbitrary URL from a profile. */
export async function receiptLogo(
  url: string | null | undefined,
  churchId: string
): Promise<string | undefined> {
  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_URL) return undefined
  try {
    const source = new URL(url),
      storage = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
    if (
      !['https:', 'http:'].includes(source.protocol) ||
      source.origin !== storage.origin ||
      source.username ||
      source.password ||
      !decodeURIComponent(source.pathname).startsWith(
        `/storage/v1/object/public/church-assets/${churchId}/`
      )
    )
      return undefined
    const response = await fetch(source, {
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    const limit = 5 * 1024 * 1024
    if (
      !response.ok ||
      !response.body ||
      Number(response.headers.get('content-length') ?? 0) > limit
    )
      return undefined
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > limit) {
        await reader.cancel()
        return undefined
      }
      chunks.push(part.value)
    }
    // PDF rendering accepts PNG/JPEG. Normalize WebP and other uploaded formats.
    const png = await sharp(Buffer.concat(chunks), {
      limitInputPixels: 25_000_000,
    })
      .rotate()
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    // A removed or temporarily unavailable logo must not prevent a receipt.
    return undefined
  }
}
