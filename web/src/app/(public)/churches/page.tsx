import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { ChurchesDirectory } from '@/components/churches/ChurchesDirectory'

export const metadata: Metadata = {
  title: 'Find a Church - ChurchMS',
  description:
    'Browse churches using ChurchMS. Find a congregation near you and join in a few taps.',
}

export const revalidate = 60

export default async function ChurchesPage() {
  const supabase = createPublicClient()

  const { data: churches } = await supabase
    .from('churches')
    .select(
      'id, name, slug, description, address, logo_url, plan, latitude, longitude'
    )
    .order('name')

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mb-8">
        <h1 className="text-4xl font-bold mb-3">Find a church</h1>
        <p className="text-muted-foreground">
          Browse churches already using ChurchMS on the map below, or start
          your own. Search to narrow the map to a specific church.
        </p>
      </div>

      <ChurchesDirectory churches={churches ?? []} />
    </div>
  )
}
