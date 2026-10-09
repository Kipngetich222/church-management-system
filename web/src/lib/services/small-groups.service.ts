import { createClient } from '@/lib/supabase/server'

export type SmallGroupRow = {
  id: string
  name: string
  description: string | null
  meeting_day: string | null
  meeting_time: string | null
  location: string | null
  leader_membership_id: string | null
  leader: {
    id: string
    users: { full_name: string | null; email: string } | null
  } | null
  small_group_members: { id: string }[]
}

export async function listSmallGroups(
  churchId: string
): Promise<SmallGroupRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('small_groups')
    .select(
      `
      id, name, description, meeting_day, meeting_time, location, leader_membership_id,
      leader:church_memberships!small_groups_leader_membership_id_fkey(
        id, users(full_name, email)
      ),
      small_group_members(id)
    `
    )
    .eq('church_id', churchId)
    .order('name')

  if (error) throw error
  return (data ?? []) as unknown as SmallGroupRow[]
}

export async function getSmallGroup(churchId: string, groupId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('small_groups')
    .select(
      `
      id, name, description, meeting_day, meeting_time, location, leader_membership_id
    `
    )
    .eq('id', groupId)
    .eq('church_id', churchId)
    .single()

  if (error) return null
  return data
}
