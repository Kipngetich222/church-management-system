import { getActiveChurch } from '@/lib/utils/church-scope'
import { listOfferings } from '@/lib/services/finance.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { OfferingsTable } from '@/components/finance/OfferingsTable'

export default async function OfferingsPage() {
  const { churchId } = await getActiveChurch()
  const offerings = await listOfferings(churchId)
  const total = offerings.reduce((s, o) => s + Number(o.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Offerings</h1>
          <p className="text-sm text-muted-foreground">
            {offerings.length} record{offerings.length !== 1 ? 's' : ''} · Total KES {total.toLocaleString()}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/finance/offerings/new">
            <Plus className="h-4 w-4 mr-2" /> Record offering
          </Link>
        </Button>
      </div>
      <OfferingsTable offerings={offerings} />
    </div>
  )
}