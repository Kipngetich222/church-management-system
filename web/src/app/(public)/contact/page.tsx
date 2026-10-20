import type { Metadata } from 'next'
import { ContactForm } from '@/components/public/ContactForm'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Mail, MessageSquare, MapPin, Phone } from 'lucide-react'

const contactEmail =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'victoryegon222@gmail.com'
const contactPhone =
  process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '+254 759 213 531'
const contactPhoneHref = `tel:${contactPhone.replace(/[^\d+]/g, '')}`

export const metadata: Metadata = {
  title: 'Contact — ChurchOnline',
  description:
    'Get in touch with the ChurchOnline team. We are here to help your church get set up and thriving.',
}

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="max-w-2xl mb-10">
        <h1 className="text-4xl font-bold mb-3">Get in touch</h1>
        <p className="text-muted-foreground">
          Questions about pricing, migrations or getting your team onboarded?
          Send us a message and we will respond within one business day.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Send us a message</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactForm />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Email</p>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {contactEmail}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Phone</p>
                  <a
                    href={contactPhoneHref}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {contactPhone}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Support hours</p>
                  <p className="text-muted-foreground">
                    Mon–Fri, 8am–6pm EAT
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-muted-foreground">Nairobi, Kenya</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
