import Link from 'next/link'
import type { Metadata } from 'next'
import { PricingCards } from '@/components/public/PricingCards'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Check } from 'lucide-react'
import { PLAN_FEATURES, PLANS, formatPlanPrice } from '@/lib/constants/plans'

export const metadata: Metadata = {
  title: 'Pricing - ChurchOnline',
  description:
    'Simple, transparent pricing for churches of every size. Every plan includes every feature.',
}

const starter = PLANS[0]
const growth = PLANS[1]

const faqs = [
  {
    q: 'What is the difference between the plans?',
    a: 'Your church size. The Starter plan supports up to 200 members, while the Growth plan allows unlimited members. Every feature in the system is available on both plans.',
  },
  {
    q: 'What happens when we reach 200 members on Starter?',
    a: 'Everything keeps working - your records, giving and events stay safe. The only change is that no new members can join until an admin upgrades the church to the Growth plan. Anyone who tries to join a full church is told why, and your admins are notified.',
  },
  {
    q: 'How do we upgrade?',
    a: 'Any super admin can upgrade any time from Plan and Billing in the admin dashboard - you do not have to wait until you are full.',
  },
  {
    q: 'How much does it cost?',
    a: 'Starter is KSh 2,500 per month and Growth is KSh 5,500 per month. Kenyan churches can pay by M-Pesa or card and get a receipt for their records.',
  },
  {
    q: 'What about data privacy?',
    a: 'Every church is isolated with row-level security. Your members and giving data are only ever visible to people you authorise.',
  },
]

export default function PricingPage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-primary/5 to-background py-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Simple, honest pricing
          </h1>
          <p className="text-lg text-muted-foreground">
            Every plan includes every feature. You only pay for how many members
            your church can hold.
          </p>
          <p className="mt-4 inline-block rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
            Everything is free for now while the platform is in development.
          </p>
        </div>
      </section>

      <PricingCards />

      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold mb-3 text-center">
            What actually changes between plans?
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            Just one thing: church size. Everything else is the same.
          </p>
          <Card className="overflow-hidden mb-10">
            <div className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_160px_160px] text-sm">
              <div className="p-4 font-medium border-b bg-muted/50">&nbsp;</div>
              <div className="p-4 font-medium border-b text-center bg-muted/50">
                {starter.name}
              </div>
              <div className="p-4 font-medium border-b text-center bg-muted/50">
                {growth.name}
              </div>
              <div className="p-4 border-b font-medium">Monthly price</div>
              <div className="p-4 border-b text-center">
                {formatPlanPrice(starter.price)}
              </div>
              <div className="p-4 border-b text-center">
                {formatPlanPrice(growth.price)}
              </div>
              <div className="p-4 border-b font-medium">Members</div>
              <div className="p-4 border-b text-center">Up to 200</div>
              <div className="p-4 border-b text-center">Unlimited</div>
              <div className="p-4 border-b font-medium">All features</div>
              <div className="p-4 border-b flex justify-center">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <div className="p-4 border-b flex justify-center">
                <Check className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>

          <h3 className="text-xl font-semibold mb-4 text-center">
            Included in both plans
          </h3>
          <Card>
            <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
              {PLAN_FEATURES.map((feature) => (
                <div key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {feature}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold mb-8 text-center">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <Card key={faq.q}>
                <CardHeader>
                  <CardTitle className="text-base">{faq.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl font-bold mb-4">Still have questions?</h2>
          <p className="text-muted-foreground mb-6">
            We are happy to help you choose the right plan for your church.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" nativeButton={false} render={<Link href="/register" />}>
              Get started free
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/contact" />}
            >
              Talk to us
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
