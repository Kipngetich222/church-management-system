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
import { Check, Minus } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pricing — ChurchMS',
  description:
    'Simple, transparent pricing for churches of every size. Start free and upgrade when you grow.',
}

const comparison = [
  { feature: 'Member records & CSV import', basic: true, premium: true },
  { feature: 'Offerings & expense tracking', basic: true, premium: true },
  { feature: 'Event calendar & reminders', basic: true, premium: true },
  { feature: 'Bulk SMS to members', basic: true, premium: true },
  { feature: 'PDF report export', basic: true, premium: true },
  { feature: 'Member login & dashboard', basic: false, premium: true },
  { feature: 'Departments with leaders', basic: false, premium: true },
  { feature: 'Finance analytics & charts', basic: false, premium: true },
  { feature: 'In-app messaging', basic: false, premium: true },
  { feature: 'Role switching (admin ? member)', basic: false, premium: true },
  { feature: 'Pledge & campaign tracking', basic: false, premium: true },
]

const faqs = [
  {
    q: 'Is there really a free plan?',
    a: 'Yes. The Basic plan is free forever for small congregations. You only upgrade when you need member logins, departments and advanced analytics.',
  },
  {
    q: 'How do I pay?',
    a: 'Premium can be paid by M-Pesa or card. Kenyan churches can pay in KES and get a receipt for their records.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Absolutely. Upgrade, downgrade or cancel at any time from your church settings — your data stays with you.',
  },
  {
    q: 'Do you support multiple churches?',
    a: 'Yes. One account can belong to multiple churches with a different role in each, and switch between them from the dashboard.',
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
            Start free. Upgrade when your church grows. No hidden fees.
          </p>
        </div>
      </section>

      <PricingCards />

      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold mb-8 text-center">
            Compare plans
          </h2>
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_120px_120px] text-sm">
              <div className="p-4 font-medium border-b bg-muted/50">Feature</div>
              <div className="p-4 font-medium border-b text-center bg-muted/50">
                Basic
              </div>
              <div className="p-4 font-medium border-b text-center bg-muted/50">
                Premium
              </div>
              {comparison.map((row) => (
                <div key={row.feature} className="contents">
                  <div className="p-4 border-b">{row.feature}</div>
                  <div className="p-4 border-b flex justify-center">
                    {row.basic ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Minus className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="p-4 border-b flex justify-center">
                    {row.premium ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Minus className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                </div>
              ))}
            </div>
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
