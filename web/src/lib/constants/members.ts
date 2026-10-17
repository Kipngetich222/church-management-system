export const MEMBER_CATEGORY_OPTIONS = [
  { value: 'men', label: 'Men', description: 'Adult men' },
  { value: 'women', label: 'Women', description: 'Adult women' },
  { value: 'youth', label: 'Youth', description: 'Teenagers and young adults' },
  { value: 'children', label: 'Children', description: 'Children and minors' },
] as const

export type MemberCategoryValue =
  (typeof MEMBER_CATEGORY_OPTIONS)[number]['value']

export const MEMBER_CATEGORY_LABELS: Record<string, string> = {
  men: 'Men',
  women: 'Women',
  youth: 'Youth',
  children: 'Children',
}

export const MEMBER_GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const

export type MemberExportScope = 'all' | 'men' | 'women' | 'youth' | 'children'

export const MEMBER_EXPORT_SCOPES: {
  value: MemberExportScope
  label: string
}[] = [
  { value: 'all', label: 'All members' },
  { value: 'men', label: 'Men only' },
  { value: 'women', label: 'Women only' },
  { value: 'youth', label: 'Youth only' },
  { value: 'children', label: 'Children only' },
]

export type MemberExportFieldSet = 'contacts' | 'contacts_email' | 'full'

export const MEMBER_EXPORT_FIELD_SETS: {
  value: MemberExportFieldSet
  label: string
  description: string
}[] = [
  {
    value: 'contacts',
    label: 'Name and phone',
    description: 'Best for SMS and phone follow-up.',
  },
  {
    value: 'contacts_email',
    label: 'Name, phone and email',
    description: 'Includes email where one is on file.',
  },
  {
    value: 'full',
    label: 'Full member data',
    description: 'Every profile field, role, badge and status.',
  },
]

export const DEFAULT_MEMBER_BADGES = [
  {
    name: 'pastor',
    description: 'Shepherds and leads the congregation',
    color: '#7c3aed',
    icon: 'crown',
    sort_order: 10,
  },
  {
    name: 'elder',
    description: 'Senior spiritual leadership',
    color: '#d97706',
    icon: 'shield',
    sort_order: 20,
  },
  {
    name: 'deacon',
    description: 'Serves the church and community',
    color: '#0d9488',
    icon: 'hand-heart',
    sort_order: 30,
  },
  {
    name: 'usher',
    description: 'Welcomes and seats the congregation',
    color: '#2563eb',
    icon: 'users',
    sort_order: 40,
  },
  {
    name: 'worship',
    description: 'Leads the church in worship',
    color: '#db2777',
    icon: 'music',
    sort_order: 50,
  },
  {
    name: 'choir',
    description: 'Sings in the church choir',
    color: '#e11d48',
    icon: 'mic',
    sort_order: 60,
  },
  {
    name: 'media',
    description: 'Runs sound, screens and live streams',
    color: '#0891b2',
    icon: 'clapperboard',
    sort_order: 70,
  },
  {
    name: 'youth',
    description: 'Leads or serves the youth ministry',
    color: '#ea580c',
    icon: 'sparkles',
    sort_order: 80,
  },
  {
    name: 'children',
    description: 'Serves the children ministry',
    color: '#16a34a',
    icon: 'baby',
    sort_order: 90,
  },
  {
    name: 'teacher',
    description: 'Teaches scripture and discipleship',
    color: '#4f46e5',
    icon: 'book-open',
    sort_order: 100,
  },
  {
    name: 'evangelist',
    description: 'Leads outreach and evangelism',
    color: '#059669',
    icon: 'megaphone',
    sort_order: 110,
  },
  {
    name: 'volunteer',
    description: 'Serves wherever needed',
    color: '#475569',
    icon: 'heart',
    sort_order: 120,
  },
] as const

export const BADGE_COLOR_PRESETS = [
  '#7c3aed',
  '#2563eb',
  '#0891b2',
  '#0d9488',
  '#16a34a',
  '#d97706',
  '#ea580c',
  '#e11d48',
  '#db2777',
  '#475569',
] as const
