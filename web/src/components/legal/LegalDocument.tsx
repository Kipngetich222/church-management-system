import type { ReactNode } from 'react'
import { LEGAL_EFFECTIVE_DATE } from '@/lib/legal'

export type LegalSection = {
  title: string
  paragraphs?: ReactNode[]
  bullets?: ReactNode[]
}

export function LegalDocument({
  title,
  description,
  sections,
}: {
  title: string
  description: string
  sections: LegalSection[]
}) {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <header className="mb-12 border-b pb-8">
        <h1 className="mb-3 text-4xl font-bold tracking-tight">{title}</h1>
        <p className="max-w-3xl text-muted-foreground">{description}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Effective {LEGAL_EFFECTIVE_DATE}
        </p>
      </header>

      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.title} className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              {section.title}
            </h2>
            {section.paragraphs?.map((paragraph, index) => (
              <p
                key={`${section.title}-p-${index}`}
                className="leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
            {section.bullets && (
              <ul className="list-disc space-y-2 pl-6 leading-relaxed text-muted-foreground">
                {section.bullets.map((bullet, index) => (
                  <li key={`${section.title}-b-${index}`}>{bullet}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
