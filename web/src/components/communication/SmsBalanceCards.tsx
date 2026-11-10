'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { SmsSummary } from '@/lib/communication'

export function SmsBalanceCards({
  churchId,
  role,
  environment,
  initial,
  showBreakdown = false,
}: {
  churchId: string
  role: string
  environment: string
  initial: SmsSummary | null
  showBreakdown?: boolean
}) {
  const [summary, setSummary] = useState(initial)
  const [error, setError] = useState(
    initial ? '' : 'SMS balance is unavailable. Try refreshing.'
  )
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/sms/summary?churchId=${churchId}`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Could not refresh SMS balance')
      setSummary(await response.json())
      setError('')
    } catch {
      setError(
        'SMS balance could not refresh. The last loaded figures are shown.'
      )
    }
  }, [churchId])
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const timer = setInterval(update, 30000)
    window.addEventListener('focus', update)
    window.addEventListener('sms-balance-changed', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', update)
      window.removeEventListener('sms-balance-changed', update)
    }
  }, [refresh])
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Church SMS balance{' '}
          {environment === 'sandbox' && (
            <span className="text-sm text-muted-foreground">(test mode)</span>
          )}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>
            Refresh balance
          </Button>
          {role === 'super_admin' && (
            <Button asChild>
              <Link href="/admin/communication/purchase">Buy SMS</Link>
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="status" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Available', summary.available, 'Ready for all church admins'],
              ['Purchased', summary.purchased, 'Total verified SMS credits'],
              ['Used', summary.used, 'Accepted by the SMS provider'],
              ['Held', summary.reserved, 'In progress or awaiting review'],
            ].map(([title, value, hint]) => (
              <Card key={String(title)}>
                <CardHeader>
                  <CardTitle className="text-sm">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">
                    {Number(value).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            One credit pays for one SMS part to one phone number. Long messages
            and Unicode text can use more parts. Rejected submissions release
            their held credits.
          </p>
          {showBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle>SMS usage by sender</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.breakdown.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="pb-3">Administrator / automation</th>
                          <th>SMS recipients</th>
                          <th>Credits used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.breakdown.map((row, index) => (
                          <tr
                            key={`${row.actor}-${index}`}
                            className="border-t"
                          >
                            <td className="py-3">{row.actor}</td>
                            <td>{row.messages.toLocaleString()}</td>
                            <td>{row.units.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No SMS credits have been used yet.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
