import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { MemberSelfEditForm } from '@/components/members/MemberSelfEditForm'
import { notFound } from 'next/navigation'

type RawMembership = {
  id: string
  address: string | null
  date_of_birth: string | null
  gender: string | null
  users:
    | {
        full_name: string | null
        phone: string | null
        avatar_url: string | null
      }
    | {
        full_name: string | null
        phone: string | null
        avatar_url: string | null
      }[]
    | null
}

export default async function EditProfilePage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('church_memberships')
    .select(
      'id, address, date_of_birth, gender, users(full_name, phone, avatar_url)'
    )
    .eq('user_id', user!.id)
    .eq('church_id', churchId)
    .maybeSingle()

  const raw = data as unknown as RawMembership | null
  if (!raw) notFound()

  const rawUser = raw.users
  const userProfile = Array.isArray(rawUser) ? (rawUser[0] ?? null) : rawUser

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Edit profile</h1>
      <MemberSelfEditForm
        membership={{
          id: raw.id,
          address: raw.address,
          date_of_birth: raw.date_of_birth,
          gender: raw.gender,
          users: userProfile,
        }}
      />
    </div>
  )
}
