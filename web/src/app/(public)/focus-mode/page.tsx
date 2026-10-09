import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { WaitlistForm } from '@/components/public/WaitlistForm'
import {
  Smartphone,
  BellOff,
  BookOpen,
  Timer,
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Focus Mode — ChurchMS',
  description:
    'A mobile companion that removes distractions so members can engage fully with the Word.',
}

const steps = [
  {
    icon: Smartphone,
    title: 'Start the session',
    desc: 'Open Focus Mode before the service or your personal devotion time.',
  },
  {
    icon: BellOff,
    title: 'Silence the noise',
    desc: 'Notifications, social media and distracting apps are paused for the session.',
  },
  {
    icon: BookOpen,
    title: 'Engage with the Word',
    desc: 'Follow along with the sermon, notes and daily scripture without distraction.',
  },
  {
    icon: Timer,
    title: 'Come back refreshed',
    desc: 'When the session ends, everything returns to normal — no lost notifications.',
  },
]

const benefits = [
  {
    icon: BookOpen,
    title: 'deeper engagement',
    desc: 'Members arrive and stay present through the whole service.',
  },
  {
    icon: ShieldCheck,
    title: 'private by design',
    desc: 'Focus sessions are personal; churches only see anonymous aggregate engagement.',
  },
  {
    icon: HeartHandshake,
    title: 'built for devotion',
    desc: 'Daily scripture and prayer prompts keep the habit going through the week.',
  },
]

export default function FocusModePage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-primary/5 to-background py-20">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center max-w-5xl">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1 text-sm mb-6">
              <Smartphone className="h-4 w-4" />
              Mobile companion
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Focus Mode for undistracted devotion
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              One tap blocks social media and notifications, so members can
              engage fully with the Word — no distractions.
            </p>
            <div id="waitlist" className="space-y-3">
              <p className="text-sm font-medium">Join the mobile waitlist</p>
              <WaitlistForm />
            </div>
          </div>
          <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 grid place-items-center">
            <Smartphone className="h-40 w-40 text-primary/40" />
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">
            How Focus Mode works
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {steps.map((step, index) => (
              <Card key={step.title}>
                <CardHeader>
                  <div className="text-xs font-semibold text-primary mb-2">
                    STEP {index + 1}
                  </div>
                  <step.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-base">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">
            Why churches love it
          </h2>
          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {benefits.map((b) => (
              <Card key={b.title}>
                <CardContent className="pt-6 space-y-3">
                  <b.icon className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold capitalize">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl font-bold mb-4">
            Ready to bring focus back?
          </h2>
          <p className="text-muted-foreground mb-6">
            Focus Mode is rolling out to churches on ChurchMS. Get an early
            look by joining the waitlist or exploring the platform today.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" nativeButton={false} render={<a href="#waitlist" />}>
              Join the waitlist
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/register" />}
            >
              Get started free
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
