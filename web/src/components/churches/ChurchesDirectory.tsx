'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChurchMap, type MapChurch } from '@/components/maps/ChurchMap'
import { MapPin, Search, Church as ChurchIcon } from 'lucide-react'

export type ChurchSummary = {
  id: string
  name: string
  slug: string
  description: string | null
  address: string | null
  logo_url: string | null
  plan: string | null
  latitude: number | null
  longitude: number | null
}

export function ChurchesDirectory({ churches }: { churches: ChurchSummary[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return churches
    return churches.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.slug.toLowerCase().includes(needle) ||
        (c.description ?? '').toLowerCase().includes(needle) ||
        (c.address ?? '').toLowerCase().includes(needle)
    )
  }, [churches, query])

  // When the user searches, narrow the map to the first matching church.
  const focusId = query.trim() ? (filtered[0]?.id ?? null) : null

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, location, or description..."
          className="pl-9"
        />
      </div>

      <ChurchMap
        churches={churches as MapChurch[]}
        focusId={focusId}
        height={360}
      />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <ChurchIcon className="h-12 w-12 text-muted-foreground/50 mx-auto" />
            <div>
              <p className="font-medium">No churches matched your search.</p>
              <p className="text-sm text-muted-foreground">
                Try a different name or location.
              </p>
            </div>
            <Button nativeButton={false} render={<Link href="/register" />}>
              Create your church
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((church) => (
            <Link key={church.id} href={`/churches/${church.slug}`}>
              <Card className="h-full hover:shadow-md transition">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {church.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={church.logo_url}
                        alt={church.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-primary/10 grid place-items-center text-primary font-bold">
                        {church.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="truncate">{church.name}</CardTitle>
                      {church.plan === 'premium' && (
                        <Badge variant="secondary" className="mt-1">
                          Premium
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {church.description ?? 'A church community on ChurchMS.'}
                  </p>
                  {church.address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {church.address}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
