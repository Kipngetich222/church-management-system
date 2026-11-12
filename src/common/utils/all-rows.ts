/** Read every page for a calculation; callers supply a deterministic ordering. */
export async function allRows<T>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: T[] | null
    error: { message: string } | null
  }>
): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += 500) {
    const result = await page(offset, offset + 499)
    if (result.error)
      throw new Error('Unable to load all finance records. Please try again.')
    const batch = result.data ?? []
    rows.push(...batch)
    if (batch.length < 500) return rows
  }
}
