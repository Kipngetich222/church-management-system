export type SetupStepKey =
  'profile' | 'leadership' | 'members' | 'departments' | 'events'

export type SetupStep = {
  key: SetupStepKey
  label: string
  description: string
  href: string
}

/**
 * Ordered onboarding steps shown on the admin dashboard until every step is
 * complete. Completion is derived from live church data (see church-setup.ts).
 */
export const SETUP_STEPS: SetupStep[] = [
  {
    key: 'profile',
    label: 'Complete your church profile',
    description: 'Add contact details and set your location on the map.',
    href: '/admin/settings/church-profile',
  },
  {
    key: 'leadership',
    label: 'Set up your church leadership',
    description:
      'Add your leadership team so members and visitors can see who leads your church.',
    href: '/admin/settings/leadership',
  },
  {
    key: 'members',
    label: 'Add your members',
    description: 'Import or invite the people in your congregation.',
    href: '/admin/members',
  },
  {
    key: 'departments',
    label: 'Create departments',
    description: 'Organise ministries such as worship, youth, and ushering.',
    href: '/admin/departments',
  },
  {
    key: 'events',
    label: 'Plan an event',
    description: 'Schedule a service or activity for your church.',
    href: '/admin/events',
  },
]
