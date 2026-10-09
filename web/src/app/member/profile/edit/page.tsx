import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { MemberSelfEditForm } from '@/components/members/MemberSelfEditForm'

export default async function EditProfilePage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id, address, users(full_name, phone, avatar_url)')
    .eq('user_id', user!.id)
    .eq('church_id', churchId)
    .single()

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Edit profile</h1>
      <MemberSelfEditForm membership={membership as any} />
    </div>
  )
}
