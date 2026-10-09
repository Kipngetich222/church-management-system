import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { BadgeChip } from '@/components/members/BadgeChip'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ membershipId: string }>
}) {
  const { membershipId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('church_memberships')
    .select('users(full_name), churches(name)')
    .eq('id', membershipId)
    .single()

  const u = data?.users
  return {
    title: u?.full_name ? `${u.full_name} — ${data?.churches?.name}` : 'Member',
  }
}

export default async function PublicMemberPage({
  params,
}: {
  params: Promise<{ membershipId: string }>
}) {
  const { membershipId } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('church_memberships')
    .select(
      `
      id, badges, is_baptized,
      users(full_name, avatar_url),
      churches(name, logo_url)
    `
    )
    .eq('id', membershipId)
    .single()

  if (!data) notFound()
  const u = data.users
  const c = data.churches

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="bg-background rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
        <Avatar className="h-24 w-24 mx-auto">
          <AvatarImage src={u.avatar_url ?? undefined} />
          <AvatarFallback>
            {u.full_name?.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-bold">{u.full_name}</h1>
          <p className="text-sm text-muted-foreground">{c.name}</p>
        </div>
        <div className="flex flex-wrap gap-1 justify-center">
          {data.badges?.map((b: string) => (
            <BadgeChip key={b} badge={b} />
          ))}
          {data.is_baptized && <BadgeChip badge="baptized" />}
        </div>
        {c.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.logo_url}
            alt={c.name}
            className="h-12 mx-auto opacity-70"
          />
        )}
      </div>
    </div>
  )
}
