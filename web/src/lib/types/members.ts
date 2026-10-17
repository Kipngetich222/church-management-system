export type MemberBadgeDefinition = {
  id?: string
  name: string
  description: string | null
  color: string
  icon: string
  sort_order?: number
  assignedCount?: number
}

export type MemberUser = {
  id?: string
  email: string | null
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  date_of_birth?: string | null
  gender?: string | null
  category?: string | null
}

export type MemberRecord = {
  id: string
  user_id: string | null
  role: string
  badges: string[]
  is_baptized: boolean
  status: string | null
  joined_at: string
  date_of_birth: string | null
  gender: string | null
  phone: string | null
  address: string | null
  full_name: string | null
  email: string | null
  category: string | null
  avatar_url: string | null
  is_manual: boolean
  users: MemberUser | null
}

export function memberName(member: MemberRecord): string {
  return (
    member.users?.full_name ||
    member.full_name ||
    member.users?.email ||
    member.email ||
    'Unnamed member'
  )
}

export function memberEmail(member: MemberRecord): string {
  return member.users?.email || member.email || ''
}

export function memberPhone(member: MemberRecord): string {
  return member.users?.phone || member.phone || ''
}

export function memberAvatar(member: MemberRecord): string | null {
  return member.users?.avatar_url || member.avatar_url || null
}

export function memberHasAccount(member: MemberRecord): boolean {
  return Boolean(member.user_id)
}
export type MemberStats = {
  total: number
  men: number
  women: number
  youth: number
  children: number
  withAccount: number
  withoutAccount: number
}

export function ageFromDate(value: string | null): number | null {
  if (!value) return null
  const dob = new Date(value)
  if (Number.isNaN(dob.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const month = today.getMonth() - dob.getMonth()
  if (month < 0 || (month === 0 && today.getDate() < dob.getDate())) age -= 1
  return age >= 0 && age < 130 ? age : null
}

/** Category used for the dashboard cards, with a sensible age fallback. */
export function effectiveMemberCategory(member: MemberRecord): string | null {
  const category = member.category?.toLowerCase()
  if (
    category === 'men' ||
    category === 'women' ||
    category === 'youth' ||
    category === 'children'
  ) {
    return category
  }

  const age = ageFromDate(member.date_of_birth)
  if (age !== null) {
    if (age < 13) return 'children'
    if (age < 30) return 'youth'
  }

  if (member.gender === 'male') return 'men'
  if (member.gender === 'female') return 'women'
  return null
}

export function getMemberStats(members: MemberRecord[]): MemberStats {
  const stats: MemberStats = {
    total: members.length,
    men: 0,
    women: 0,
    youth: 0,
    children: 0,
    withAccount: 0,
    withoutAccount: 0,
  }

  for (const member of members) {
    const category = effectiveMemberCategory(member)
    if (category === 'men') stats.men += 1
    if (category === 'women') stats.women += 1
    if (category === 'youth') stats.youth += 1
    if (category === 'children') stats.children += 1
    if (member.user_id) stats.withAccount += 1
    else stats.withoutAccount += 1
  }

  return stats
}
