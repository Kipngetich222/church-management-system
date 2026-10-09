import { createClient } from '@/lib/supabase/server'

export type MemberRow = {
  id: string
  user_id: string
  role: 'super_admin' | 'dept_admin' | 'member'
  badges: string[]
  is_baptized: boolean
  status: string
  joined_at: string
  date_of_birth: string | null
  gender: string | null
  phone: string | null
  address: string | null
  users: {
    id: string
    email: string
    full_name: string | null
    phone: string | null
    avatar_url: string | null
  } | null
  department_members?: { department_id: string }[]
}

export async function listMembers(churchId: string): Promise<MemberRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('church_memberships')
    .select(
      `
      id, user_id, role, badges, is_baptized, status, joined_at,
      date_of_birth, gender, phone, address,
      users!inner(id, email, full_name, phone, avatar_url)
    `
    )
    .eq('church_id', churchId)
    .order('joined_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as MemberRow[]
}
