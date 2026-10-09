import { createClient } from '@/lib/supabase/server'

export async function listDepartments(churchId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('departments')
    .select(
      `
      id, name, description, color, created_at,
      department_members(
        id, is_leader,
        church_memberships(
          id, user_id,
          users(full_name, email, avatar_url)
        )
      )
    `
    )
    .eq('church_id', churchId)
    .order('name')

  if (error) throw error
  return data ?? []
}
