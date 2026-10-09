import { Button } from '@/components/ui/button'
import { Smartphone } from 'lucide-react'

export function FocusModeSection() {
  return (
    <section className="py-24 bg-primary/5">
      <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1 text-sm mb-4">
            <Smartphone className="h-4 w-4" />
            Mobile-only feature
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Focus Mode for undistracted devotion
          </h2>
          <p className="text-muted-foreground mb-6">
            One tap blocks social media and notifications, so members can engage
            fully with the Word — no distractions.
          </p>
          <Button nativeButton={false} render={<a href="#waitlist" />}>
            Join the Mobile Waitlist
          </Button>
        </div>
        <div className="aspect-video rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Smartphone className="h-32 w-32 text-primary/40" />
        </div>
      </div>
    </section>
  )
}
