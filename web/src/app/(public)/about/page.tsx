import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { HeartHandshake, Users, ShieldCheck, Sparkles } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About — ChurchMS',
  description:
    'ChurchMS helps churches across East Africa care for their people and steward their resources well.',
}

const values = [
  {
    icon: HeartHandshake,
    title: 'Serve the church',
    desc: 'We build for real congregations, not boardrooms. Every feature starts with a real need from a local church.',
  },
  {
    icon: Users,
    title: 'People first',
    desc: 'Ministry is about people. Our tools free up leaders to spend less time on admin and more time with their flock.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust & privacy',
    desc: 'Giving and member data are sensitive. We isolate every church and never sell or share your data.',
  },
  {
    icon: Sparkles,
    title: 'Excellence',
    desc: 'Simple, fast software that works on the devices and connections churches actually have.',
  },
]

export default function AboutPage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-primary/5 to-background py-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Built to help the Church thrive
          </h1>
          <p className="text-lg text-muted-foreground">
            ChurchMS started with a simple observation: church leaders spend too
            much time wrestling with spreadsheets, WhatsApp groups and paper
            records. We are changing that.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl space-y-6 text-muted-foreground leading-relaxed">
          <p>
            Our mission is to give every church — from a small rural
            congregation to a growing city parish — the tools to know their
            people, steward their resources faithfully and communicate clearly.
          </p>
          <p>
            We are built for Kenya and East Africa: M-Pesa giving, SMS
            communication, KES pricing and offline-friendly design. And because
            we know trust is earned, every church&apos;s data is isolated and
            protected with row-level security.
          </p>
          <p>
            Whether you are planting a new church or managing a multi-branch
            congregation, ChurchMS grows with you.
          </p>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">What we value</h2>
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            {values.map((v) => (
              <Card key={v.title}>
                <CardContent className="pt-6 space-y-3">
                  <v.icon className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 text-center">
        <div className="container mx-auto px-4 max-w-2xl">
          <h2 className="text-3xl font-bold mb-4">
            Join the churches already using ChurchMS
          </h2>
          <p className="text-muted-foreground mb-6">
            Start free today — no credit card required.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" nativeButton={false} render={<Link href="/register" />}>
              Get started
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/contact" />}
            >
              Contact us
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
