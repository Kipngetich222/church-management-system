import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HeroHeadline } from './HeroHeadline'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-24">
      <div className="container mx-auto px-4 text-center max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1 text-sm mb-6">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Built for modern churches
        </div>

        <HeroHeadline />

        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Members, events, giving, departments, and communication — all in one
          platform designed to help your congregation thrive.
        </p>

        <div className="flex gap-4 justify-center flex-wrap">
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/register" />}
          >
            Start Free
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href="/features" />}
          >
            See Features
          </Button>
        </div>
      </div>
    </section>
  )
}