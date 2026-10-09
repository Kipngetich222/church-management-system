import { getDailyScripture } from '@/lib/services/scripture.service'

export async function DailyScripture() {
  const scripture = await getDailyScripture()

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4 max-w-3xl text-center">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">
          Verse of the Day
        </p>
        <blockquote className="text-2xl md:text-3xl font-serif italic mb-4">
          &quot;{scripture.text}&quot;
        </blockquote>
        <cite className="text-muted-foreground not-italic">
          — {scripture.reference} ({scripture.translation})
        </cite>
      </div>
    </section>
  )
}
