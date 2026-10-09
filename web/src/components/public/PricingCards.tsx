import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Check } from 'lucide-react'
import Link from 'next/link'

const plans = [
  {
    name: 'Basic',
    price: 'Free',
    tagline: 'For small congregations getting started',
    features: [
      'Admin accounts only',
      'Member records & CSV import',
      'Finance tracking (offerings, expenses)',
      'PDF report export',
      'Bulk SMS to members',
      'Event calendar & reminders',
    ],
    cta: 'Start Free',
    href: '/register?plan=basic',
  },
  {
    name: 'Premium',
    price: '$29/mo',
    tagline: 'For growing churches with departments',
    features: [
      'Everything in Basic',
      'Member login & dashboard',
      'Departments with leaders',
      'Finance analytics (charts)',
      'In-app messaging',
      'Role switching (admin ↔ member)',
      'Pledge & campaign tracking',
    ],
    cta: 'Start Premium',
    href: '/register?plan=premium',
    popular: true,
  },
]

export function PricingCards() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple pricing
          </h2>
          <p className="text-muted-foreground">Start free, upgrade anytime.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.popular ? 'border-primary shadow-lg' : ''}
            >
              {plan.popular && (
                <div className="bg-primary text-primary-foreground text-center text-xs py-1 rounded-t-lg font-medium">
                  MOST POPULAR
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="text-3xl font-bold">{plan.price}</div>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  nativeButton={false}
                  render={<Link href={plan.href} />}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
