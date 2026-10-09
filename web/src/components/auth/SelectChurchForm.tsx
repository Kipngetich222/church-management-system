'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { setActiveChurch } from '@/lib/auth/active-church'
import { dashboardPathForRole } from '@/lib/auth/redirect'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Church, ChevronRight } from 'lucide-react'

type ChurchOption = {
  churchId: string
  role: string
  name: string
  slug: string
  logoUrl: string | null
  plan: string | null
}

export function SelectChurchForm({ options }: { options: ChurchOption[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  function choose(option: ChurchOption) {
    if (selected) return
    setSelected(option.churchId)
    // Remember the choice so every future visit lands on this church.
    setActiveChurch(option.churchId)
    router.push(dashboardPathForRole(option.role))
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a church</CardTitle>
        <CardDescription>
          You belong to more than one church. Pick the one you want to open.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {options.map((option) => (
          <button
            key={option.churchId}
            type="button"
            disabled={selected !== null}
            onClick={() => choose(option)}
            className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted disabled:opacity-60"
          >
            {option.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={option.logoUrl}
                alt={option.name}
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Church className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{option.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                /{option.slug}
              </div>
            </div>
            <Badge variant={option.role === 'member' ? 'secondary' : 'default'}>
              {option.role.replace('_', ' ')}
            </Badge>
            {selected === option.churchId ? (
              <Spinner className="text-primary" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ))}

        <Button
          variant="ghost"
          className="w-full"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to homepage
        </Button>
      </CardContent>
    </Card>
  )
}
