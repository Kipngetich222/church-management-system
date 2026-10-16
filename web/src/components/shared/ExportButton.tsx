'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react'
import { downloadCsv, type CsvValue } from '@/lib/utils/csv'

function baseName(filename: string) {
  return filename.replace(/\.(csv|pdf)$/i, '')
}

function titleFromFilename(filename: string) {
  return baseName(filename).replace(/[-_]+/g, ' ').trim() || 'Report'
}

/**
 * Reusable export control for admin tables. The first row is treated as the
 * header; the admin chooses between a CSV download (built in the browser) and a
 * printable PDF. The PDF is rendered server-side so it shares the same columns
 * the screen shows.
 */
export function ExportButton({
  filename,
  rows,
  label = 'Export',
  title,
  className,
}: {
  filename: string
  rows: CsvValue[][]
  label?: string
  title?: string
  className?: string
}) {
  const [pending, setPending] = useState(false)
  const base = baseName(filename)

  async function handlePdf() {
    setPending(true)
    try {
      const columns = (rows[0] ?? []).map((value) => String(value ?? ''))
      const dataRows = rows
        .slice(1)
        .map((row) => row.map((value) => String(value ?? '')))

      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title ?? titleFromFilename(filename),
          columns,
          rows: dataRows,
          filename: base,
        }),
      })
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${base}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      window.alert('Could not generate the PDF. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={className}
            disabled={pending}
          />
        }
      >
        {pending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => downloadCsv(`${base}.csv`, rows)}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf}>
          <FileText className="h-4 w-4 mr-2" /> Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}