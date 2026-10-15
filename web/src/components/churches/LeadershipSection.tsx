import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Phone } from 'lucide-react'

export type PublicLeader = {
  id: string
  name: string
  title: string
  email: string | null
  phone: string | null
  image_url: string | null
}

/**
 * Read-only view of a church's leadership structure. Shown on the public
 * church profile so members and visitors can see who leads the church.
 */
export function LeadershipSection({ leaders }: { leaders: PublicLeader[] }) {
  if (!leaders.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Church leadership</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {leaders.map((leader) => (
            <div key={leader.id} className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border bg-muted flex items-center justify-center">
                {leader.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leader.image_url}
                    alt={leader.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-semibold text-muted-foreground">
                    {leader.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">{leader.name}</p>
                <p className="truncate text-xs text-primary">{leader.title}</p>
                {leader.email && (
                  <a
                    href={`mailto:${leader.email}`}
                    className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:underline"
                  >
                    <Mail className="h-3 w-3 shrink-0" /> {leader.email}
                  </a>
                )}
                {leader.phone && (
                  <a
                    href={`tel:${leader.phone}`}
                    className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:underline"
                  >
                    <Phone className="h-3 w-3 shrink-0" /> {leader.phone}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}