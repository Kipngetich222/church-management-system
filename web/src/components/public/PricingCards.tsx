import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { PLANS, PLAN_FEATURES, formatPlanPrice } from '@/lib/constants/plans'

export function PricingCards() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple pricing
          </h2>
          <p className="text-muted-foreground">
            One price per church, based on your size. Every plan includes every
            feature in the system.
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-10 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-center text-sm">
          Everything is free for now while the platform is in development.
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <Card
              key={plan.tier}
              className={plan.popular ? 'border-primary shadow-lg' : ''}
            >
              {plan.popular && (
                <div className="bg-primary text-primary-foreground text-center text-xs py-1 rounded-t-lg font-medium">
                  FOR GROWING CHURCHES
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="text-3xl font-bold">
                  {formatPlanPrice(plan.price)}
                </div>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                <p className="text-sm font-medium text-primary">
                  {plan.memberLimit
                    ? 'Up to ' + plan.memberLimit + ' members'
                    : 'Unlimited members'}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {PLAN_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  nativeButton={false}
                  render={<Link href={plan.href + '?plan=' + plan.tier} />}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Every plan unlocks every feature. The only difference is how many
          members your church can hold.
        </p>
      </div>
    </section>
  )
}
