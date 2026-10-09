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
} from 'lucide-react'

const features = [
  {
    icon: Users,
    title: 'Member Management',
    desc: 'CRUD, badges, departments, baptism tracking.',
  },
  {
    icon: Calendar,
    title: 'Events & Calendar',
    desc: 'Shareable events with QR codes and maps.',
  },
  {
    icon: DollarSign,
    title: 'Finance',
    desc: 'Offerings, expenses, pledges, and reports.',
  },
  {
    icon: MessageSquare,
    title: 'Communication',
    desc: 'Bulk SMS, email, scheduled reminders.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    desc: 'Growth, giving, and attendance trends.',
  },
  {
    icon: QrCode,
    title: 'QR Attendance',
    desc: 'Members scan in — instant tracking.',
  },
]

export function FeaturesShowcase() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything your church needs
          </h2>
          <p className="text-muted-foreground">
            From member care to finances, all in one platform.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
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
  )
}
