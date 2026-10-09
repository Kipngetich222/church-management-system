'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, CheckCircle2, XCircle } from 'lucide-react'

export default function ImportPage() {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [results, setResults] = useState<
    { email: string; ok: boolean; error?: string }[]
  >([])
  const [loading, setLoading] = useState(false)

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter(Boolean)
    const headers = lines[0]
      .split(',')
      .map((h) => h.trim().replace(/^"|"$/g, ''))
    return lines.slice(1).map((line) => {
      const cells =
        line.match(/(".*?"|[^,]+)/g)?.map((c) => c.replace(/^"|"$/g, '')) ?? []
      return Object.fromEntries(
        headers.map((h, i) => [h, cells[i]?.trim() ?? ''])
      )
    })
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setRows(parseCSV(String(reader.result)))
    reader.readAsText(file)
  }

  async function importAll() {
    setLoading(true)
    const activeChurchId = localStorage.getItem('active_church_id')
    const out: typeof results = []
    for (const row of rows) {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchId: activeChurchId,
          full_name: row.name || row.full_name,
          email: row.email,
          phone: row.phone || '',
          badges: row.badges ? row.badges.split('|').filter(Boolean) : [],
        }),
      })
      const data = await res.json()
      out.push({ email: row.email, ok: res.ok, error: data.error })
    }
    setResults(out)
    setLoading(false)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Import members from CSV</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            CSV columns: <code>name,email,phone,badges</code>. Use{' '}
            <code>|</code> to separate multiple badges.
          </p>

          <label className="flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted/30">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm">Click to select a CSV file</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={onFile}
            />
          </label>

          {rows.length > 0 && (
            <>
              <p className="text-sm">
                {rows.length} row{rows.length !== 1 ? 's' : ''} parsed.
              </p>
              <div className="max-h-60 overflow-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {Object.keys(rows[0]).map((h) => (
                        <th key={h} className="text-left p-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t">
                        {Object.values(r).map((v, j) => (
                          <td key={j} className="p-2">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={importAll} disabled={loading}>
                {loading ? 'Importing...' : `Import ${rows.length} members`}
              </Button>
            </>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {r.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>{r.email}</span>
                  {r.error && (
                    <span className="text-xs text-muted-foreground">
                      — {r.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
