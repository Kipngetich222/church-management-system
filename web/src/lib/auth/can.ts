export type Permission =
  | 'members:*' | 'members:read' | 'members:write'
  | 'finance:*' | 'finance:read' | 'finance:write'
  | 'events:*' | 'events:read' | 'events:write'
  | 'departments:*'
  | 'church:*'
  | 'sms:*' | 'sms:department'
  | 'prayer:read' | 'prayer:create' | 'prayer:*'
  | 'pastoral:*'
  | 'sermons:*' | 'sermons:read'
  | 'volunteers:*' | 'volunteers:read' | 'volunteers:signup'
  | 'visitors:*'
  | 'resources:*' | 'resources:book'
  | 'settings:*'
  | 'analytics:*'
  | 'reports:*'
  | 'profile:own'
  | 'giving:create'
  | 'attendance:read'

/**
 * Checks if a permission is granted. Supports wildcard matching:
 *   can(['members:*'], 'members:read')  -> true
 *   can(['members:read'], 'members:write') -> false
 *
 * This module is intentionally free of server-only imports so it can be used
 * from both server and client code.
 */
export function can(permissions: string[], required: string): boolean {
  for (const p of permissions) {
    if (p === required) return true
    const [scope, action] = p.split(':')
    if (action === '*' && required.startsWith(`${scope}:`)) return true
  }
  return false
}
