'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, CheckCircle2, XCircle } from 'lucide-react'

type Result = {
  label: string
  ok: boolean
  error?: string
}

const SAMPLE_COLUMNS = 'name,email,phone,gender,category,badges'

export function MemberImport({ churchId }: { churchId: string }) {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)

  function parseCSV(text: string) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
    if (!lines.length) return []
    const headers = lines[0]
      .split(',')
      .map((header) =>
        header
          .trim()
          .replace(/^"|"$/g, '')
          .toLowerCase()
          .replace(/[\s-]+/g, '_')
      )
    return lines.slice(1).map((line) => {
      const cells =
        line
          .match(/(".*?"|[^,]+)/g)
          ?.map((cell) => cell.replace(/^"|"$/g, '')) ?? []
      return Object.fromEntries(
        headers.map((header, index) => [header, cells[index]?.trim() ?? ''])
      )
    })
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setRows(parseCSV(String(reader.result)))
    reader.readAsText(file)
  }

  async function importAll() {
    setLoading(true)
    setResults([])
    const output: Result[] = []

    for (const row of rows) {
      const name = row.name || row.full_name || row.fullname || ''
      const email = row.email || ''
      const label = name || email || row.phone || 'Row'
      const gender = normalizeOption(row.gender, ['male', 'female'])
      const category = normalizeOption(row.category, [
        'men',
        'women',
        'youth',
        'children',
      ])
      const badges = (row.badges || '')
        .split(/[|;]/)
        .map((badge) => badge.trim())
        .filter(Boolean)
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchId,
          mode: email ? 'invite' : 'manual',
          full_name: name,
          email,
          phone: row.phone || '',
          gender,
          category: category || null,
          address: row.address || '',
          badges,
        }),
      })
      const data = await res.json().catch(() => null)
      output.push({ label, ok: res.ok, error: data?.error })
    }

    setResults(output)
    setLoading(false)
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p>
            CSV columns: <code>{SAMPLE_COLUMNS}</code>. Use <code>|</code> to
            separate multiple badges.
          </p>
          <p className="mt-1">
            Leave the email blank to create a manual member. Manual adults and
            youth need a phone number; children can be added without one.
          </p>
        </div>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 hover:bg-muted/30">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm">Click to select a CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onFile}
          />
        </label>

        {rows.length > 0 && (
          <>
            <p className="text-sm">
              {rows.length} row{rows.length !== 1 ? 's' : ''} parsed.
            </p>
            <div className="max-h-60 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    {Object.keys(rows[0]).map((header) => (
                      <th key={header} className="p-2 text-left">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t">
                      {Object.values(row).map((value, cellIndex) => (
                        <td key={cellIndex} className="p-2">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={importAll} disabled={loading}>
              {loading
                ? 'Importing...'
                : `Import ${rows.length} member${rows.length === 1 ? '' : 's'}`}
            </Button>
          </>
        )}

        {results.length > 0 && (
          <div className="space-y-1">
            {results.map((result, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                {result.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span>{result.label}</span>
                {result.error && (
                  <span className="text-xs text-muted-foreground">
                    — {result.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function normalizeOption(value: string | undefined, allowed: string[]) {
  const normalized = (value ?? '').trim().toLowerCase()
  return allowed.includes(normalized) ? normalized : ''
}
