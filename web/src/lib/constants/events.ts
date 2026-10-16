export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed'

export type EventVisibility =
  | 'public'
  | 'members_only'
  | 'all_members'
  | 'super_admins'
  | 'department'
  | 'group'
  | 'men'
  | 'women'
  | 'youth'

export type EventType = 'physical' | 'online'

export type PaymentMethod = 'free' | 'till' | 'paybill' | 'phone'

export const EVENT_VISIBILITY_LABELS: Record<EventVisibility, string> = {
  public: 'Public',
  all_members: 'All members',
  members_only: 'All members',
  super_admins: 'Super admins',
  department: 'A department',
  group: 'A group',
  men: 'Men',
  women: 'Women',
  youth: 'Youth',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  free: 'Free',
  till: 'M-Pesa Till number',
  paybill: 'M-Pesa Paybill',
  phone: 'Phone number',
}
