import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Users,
  Calendar,
  DollarSign,
  MessageSquare,
  BarChart3,
  QrCode,
  Building2,
  ShieldCheck,
  Smartphone,
  BookOpen,
  HeartHandshake,
  ClipboardList,
  Check,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Features — ChurchMS',
  description:
    'Members, giving, events, departments, communication and analytics — everything your church needs in one platform.',
}

const groups = [
  {
    title: 'People & membership',
    description: 'Know and care for your congregation well.',
    features: [
      {
        icon: Users,
        title: 'Member records',
        desc: 'Full profiles, contact details, families, badges and baptism tracking — with CSV import.',
      },
      {
        icon: Building2,
        title: 'Departments & teams',
        desc: 'Organise ministries, assign leaders and manage department members and volunteers.',
      },
      {
        icon: ClipboardList,
        title: 'Visitors & follow-up',
        desc: 'Capture first-time visitors and keep a clear follow-up log so no one slips through.',
      },
    ],
  },
  {
    title: 'Giving & finance',
    description: 'Stay on top of every shilling with confidence.',
    features: [
      {
        icon: DollarSign,
        title: 'Offerings & expenses',
        desc: 'Record tithes, offerings, expenses and pledges with M-Pesa, cash, bank and card methods.',
      },
      {
        icon: BarChart3,
        title: 'Reports & analytics',
        desc: 'Giving trends, member growth and attendance insights, exportable as PDF reports.',
      },
      {
        icon: HeartHandshake,
        title: 'Campaigns & pledges',
        desc: 'Run building funds and special campaigns with live progress tracking.',
      },
    ],
  },
  {
    title: 'Events & engagement',
    description: 'Bring your church together, online and offline.',
    features: [
      {
        icon: Calendar,
        title: 'Events & calendar',
        desc: 'Publish events publicly, share them with QR codes and let members register in seconds.',
      },
      {
        icon: QrCode,
        title: 'QR attendance',
        desc: 'Members scan in at the door — attendance is tracked automatically in real time.',
      },
      {
        icon: MessageSquare,
        title: 'Communication',
        desc: 'Bulk SMS, email and in-app announcements with scheduled reminders.',
      },
    ],
  },
  {
    title: 'Discipleship & growth',
    description: 'Help every member grow in their walk.',
    features: [
      {
        icon: BookOpen,
        title: 'Sermons & resources',
        desc: 'Share sermon videos, series and ministry resources with your congregation.',
      },
      {
        icon: Smartphone,
        title: 'Focus Mode',
        desc: 'A mobile companion that removes distractions so members can engage with the Word.',
      },
      {
        icon: ShieldCheck,
        title: 'Roles & security',
        desc: 'Granular roles for super admins, department admins and members with tenant isolation.',
      },
    ],
  },
]

export default function FeaturesPage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-primary/5 to-background py-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Everything your church needs
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            One modern platform to manage people, giving, events and
            communication — built for churches in Kenya and across East Africa.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" nativeButton={false} render={<Link href="/register" />}>
              Get started free
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/pricing" />}
            >
              See pricing
            </Button>
          </div>
        </div>
      </section>

      {groups.map((group, index) => (
        <section
          key={group.title}
          className={index % 2 === 1 ? 'py-20 bg-muted/30' : 'py-20'}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mb-12">
              <h2 className="text-3xl font-bold mb-3">{group.title}</h2>
              <p className="text-muted-foreground">{group.description}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {group.features.map((f) => (
                <Card key={f.title}>
                  <CardHeader>
                    <f.icon className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="rounded-2xl border bg-primary/5 p-8 md:p-12 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">
              Ready to bring it all together?
            </h2>
            <p className="text-muted-foreground mb-6">
              Create your church in minutes. No credit card required.
            </p>
            <ul className="flex flex-wrap gap-4 justify-center text-sm text-muted-foreground mb-8">
              {['Free to start', 'Unlimited members', 'Cancel anytime'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> {item}
                  </li>
                )
              )}
            </ul>
            <Button size="lg" nativeButton={false} render={<Link href="/register" />}>
              Get started
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
