export const PERMISSIONS = {
  super_admin: [
    'members:*',
    'finance:*',
    'events:*',
    'departments:*',
    'church:*',
    'sms:*',
    'settings:*',
  ],
  dept_admin: [
    'members:read',
    'events:read',
    'events:write:own_dept',
    'sms:department',
    'attendance:read',
  ],
  member: ['profile:own', 'events:read', 'giving:create', 'prayer:create'],
} as const

export function can(role: string, permission: string): boolean {
  const perms = PERMISSIONS[role as keyof typeof PERMISSIONS] ?? []
  return perms.some((p) => {
    if (p === permission) return true
    const [scope] = p.split(':')
    return permission.startsWith(`${scope}:`)
  })
}
