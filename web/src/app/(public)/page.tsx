import { Hero } from '@/components/public/Hero'
import { DailyScripture } from '@/components/public/DailyScripture'
import { FeaturesShowcase } from '@/components/public/FeaturesShowcase'
import { FocusModeSection } from '@/components/public/FocusModeSection'
import { PricingCards } from '@/components/public/PricingCards'

export default function HomePage() {
  return (
    <>
      <Hero />
      <DailyScripture />
      <FeaturesShowcase />
      <FocusModeSection />
      <PricingCards />
    </>
  )
}
