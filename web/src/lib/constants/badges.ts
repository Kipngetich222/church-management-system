export const BADGES = [
  'pastor',
  'usher',
  'worship',
  'choir',
  'media',
  'youth',
  'children',
  'elder',
  'deacon',
] as const

export type Badge = (typeof BADGES)[number]
