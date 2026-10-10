import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  HandCoins,
  HeartHandshake,
  Home,
  UserCircle2,
} from 'lucide-react'
import type { SidebarNavItem } from '@/components/layout/AppSidebar'

export const MEMBER_NAV: SidebarNavItem[] = [
  { label: 'Home', href: '/member/home', icon: Home, section: 'Main' },
  {
    label: 'Calendar',
    href: '/member/calendar',
    icon: CalendarDays,
    section: 'Main',
  },
  { label: 'Giving', href: '/member/giving', icon: HandCoins, section: 'Main' },
  {
    label: 'Prayer',
    href: '/member/prayer',
    icon: HeartHandshake,
    section: 'Community',
  },
  {
    label: 'Resources',
    href: '/member/resources',
    icon: BookOpen,
    section: 'Community',
  },
  {
    label: 'Volunteering',
    href: '/member/volunteering',
    icon: ClipboardList,
    section: 'Community',
  },
  {
    label: 'Profile',
    href: '/member/profile',
    icon: UserCircle2,
    section: 'Account',
  },
]
