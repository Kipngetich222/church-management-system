import Link from 'next/link'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { communicationActor } from '@/lib/services/communication-api'

export default async function CommunicationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { churchId, role } = await getActiveChurch()
  await communicationActor(churchId)
  return (
    <div className="space-y-6">
      <nav
        aria-label="Communication"
        className="flex flex-wrap gap-2 border-b pb-4 text-sm"
      >
        {[
          ['Compose', '/admin/communication/sms'],
          ['History & scheduled', '/admin/communication/history'],
          ['SMS usage', '/admin/communication/usage'],
          ['Announcements', '/admin/communication/announcements'],
          ...(role === 'super_admin'
            ? [['Buy SMS', '/admin/communication/purchase']]
            : []),
        ].map(([label, href]) => (
          <Link
            className="rounded-lg px-3 py-2 hover:bg-muted focus-visible:outline"
            key={href}
            href={href}
          >
            {label}
          </Link>
        ))}
      </nav>
      {process.env.SMS_SCHEDULER_MODE !== 'frequent' && (
        <p
          role="note"
          className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground"
        >
          Scheduled messages are checked once daily, usually between 9–10 a.m.
          East Africa Time. Your selected date and time is the earliest a
          message can be sent; messages due after the daily check wait until the
          next run. Use Send now for immediate delivery.
        </p>
      )}
      {children}
    </div>
  )
}
