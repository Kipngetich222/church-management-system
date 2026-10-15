import { requirePermission } from '@/lib/auth/guard'
import { SermonForm } from '@/components/sermons/SermonForm'
import { BackLink } from '@/components/shared/BackLink'

export default async function NewSermonPage() {
  const ctx = await requirePermission('sermons:*')
  return (
    <div className="max-w-2xl space-y-6">
      <BackLink href="/admin/sermons" label="Sermons" />

      <div>
        <h1 className="text-2xl font-bold">Add sermon</h1>
        <p className="text-sm text-muted-foreground">
          Paste a YouTube link — the video will play in-app for members.
        </p>
      </div>
      <SermonForm churchId={ctx.churchId} />
    </div>
  )
}