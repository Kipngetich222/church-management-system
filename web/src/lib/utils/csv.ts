/**
 * Trigger a CSV download in the browser.
 *
 * Used by the admin "Export" buttons so tables of records (attendance,
 * bookings, events, ...) can be kept or printed as hardcopy.
 */
export type CsvValue = string | number | boolean | null | undefined

export function downloadCsv(filename: string, rows: CsvValue[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
