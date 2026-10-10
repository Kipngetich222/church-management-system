import { BackgroundDecor } from './background-decor'
import { LightRays } from './light-rays'

type Props = {
  /** Public pages carry a slightly stronger beam than in-app dashboards. */
  variant?: 'public' | 'dashboard'
}

export function PageBackdrop({ variant = 'public' }: Props) {
  const isDashboard = variant === 'dashboard'

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <BackgroundDecor showGrid={!isDashboard} />

      <div
        className={
          isDashboard
            ? 'absolute inset-x-0 top-0 h-[45vh] opacity-70'
            : 'absolute inset-x-0 top-0 h-[80vh]'
        }
      >
        <LightRays
          className="h-full w-full"
          lightSpread={0.3}
          saturation={0.5}
          mouseInfluence={0.5}
          raysSpeed={0.8}
          rayLength={isDashboard ? 1.4 : 1.8}
          intensity={isDashboard ? 0.45 : 0.7}
        />
      </div>

      {/* Dissolve the beams into the page so content stays legible. */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background" />
    </div>
  )
}
