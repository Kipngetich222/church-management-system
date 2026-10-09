import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  DollarSign,
  MessageSquare,
  Heart,
  UsersRound,
  Settings,
  BarChart3,
  QrCode,
  UserPlus,
  FileClock,
  ClipboardList,
  PlayCircle,
} from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission?: string
  section?: string
}

export const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, section: 'Main' },
  { label: 'Members', href: '/admin/members', icon: Users, permission: 'members:read', section: 'People' },
  { label: 'Departments', href: '/admin/departments', icon: Building2, permission: 'departments:*', section: 'People' },
  { label: 'Small Groups', href: '/admin/small-groups', icon: UsersRound, permission: 'departments:*', section: 'People' },
  { label: 'Visitors', href: '/admin/visitors', icon: UserPlus, permission: 'visitors:*', section: 'People' },
  { label: 'Events', href: '/admin/events', icon: Calendar, permission: 'events:read', section: 'Ministry' },
  { label: 'Attendance', href: '/admin/attendance', icon: QrCode, permission: 'attendance:read', section: 'Ministry' },
  { label: 'Finance', href: '/admin/finance/offerings', icon: DollarSign, permission: 'finance:read', section: 'Ministry' },
  { label: 'Communication', href: '/admin/communication/sms', icon: MessageSquare, permission: 'sms:*', section: 'Ministry' },
  { label: 'Prayer Requests', href: '/admin/prayer-requests', icon: Heart, permission: 'prayer:read', section: 'Ministry' },
  { label: 'Volunteers', href: '/admin/volunteers', icon: ClipboardList, permission: 'volunteers:read', section: 'Ministry' },
  { label: 'Resources', href: '/admin/resources', icon: Building2, permission: 'resources:*', section: 'Ministry' },
  { label: 'Sermons', href: '/admin/sermons', icon: PlayCircle, permission: 'sermons:*', section: 'Ministry' },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, permission: 'analytics:*', section: 'Insights' },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: FileClock, permission: 'settings:*', section: 'Insights' },
  { label: 'Settings', href: '/admin/settings/church-profile', icon: Settings, permission: 'settings:*', section: 'System' },
]