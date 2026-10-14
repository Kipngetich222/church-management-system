/**
 * Plan tiers describe how big a church is, not what it can do. Every plan
 * unlocks every feature in the system; the only difference is member capacity.
 *
 *   starter -> up to STARTER_MEMBER_LIMIT member seats, KSh 2,500 / month
 *   growth  -> unlimited member seats,                  KSh 5,500 / month
 */
export type PlanTier = 'starter' | 'growth'

/** Maximum number of member seats a starter church can hold. */
export const STARTER_MEMBER_LIMIT = 200

export type PlanDefinition = {
  tier: PlanTier
  name: string
  /** Monthly price in Kenyan Shillings. */
  price: number
  tagline: string
  /** null means the plan has no member cap. */
  memberLimit: number | null
  cta: string
  href: string
  popular?: boolean
}

export const PLANS: PlanDefinition[] = [
  {
    tier: 'starter',
    name: 'Starter',
    price: 2500,
    tagline: 'For churches of up to 200 members',
    memberLimit: STARTER_MEMBER_LIMIT,
    cta: 'Get started',
    href: '/register',
  },
  {
    tier: 'growth',
    name: 'Growth',
    price: 5500,
    tagline: 'For established churches that keep growing',
    memberLimit: null,
    cta: 'Choose Growth',
    href: '/register',
    popular: true,
  },
]

export function planDefinition(
  tier: PlanTier | string | null | undefined
): PlanDefinition {
  return PLANS.find((plan) => plan.tier === tier) ?? PLANS[0]
}

export function planName(tier: PlanTier | string | null | undefined): string {
  return planDefinition(tier).name
}

export function planMemberLimit(
  tier: PlanTier | string | null | undefined
): number | null {
  return planDefinition(tier).memberLimit
}

export function formatPlanPrice(price: number): string {
  return `KSh ${price.toLocaleString('en-KE')}/mo`
}

/** Every plan includes every feature - listed once for both pricing cards. */
export const PLAN_FEATURES: string[] = [
  'Member records & CSV import',
  'Member logins & dashboards',
  'Departments, leaders & small groups',
  'Offerings, expenses & giving records',
  'Finance analytics & PDF reports',
  'Events, attendance & QR check-in',
  'Bulk SMS & email messaging',
  'Pledges & campaign tracking',
  'Prayer requests, sermons & resources',
  'Volunteer scheduling',
  'Role switching (admin / member)',
]
