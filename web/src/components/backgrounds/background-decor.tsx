import { cn } from '@/lib/utils'

type Box = {
  left: string
  top: string
  size: number
  delay: string
  duration: string
  gold?: boolean
  filled?: boolean
}

// Deterministic placement so the layout is stable between renders.
const BOXES: Box[] = [
  { left: '5%', top: '14%', size: 58, delay: '0s', duration: '24s', gold: true },
  { left: '16%', top: '62%', size: 34, delay: '-4s', duration: '28s' },
  { left: '28%', top: '22%', size: 22, delay: '-9s', duration: '22s', filled: true },
  { left: '38%', top: '72%', size: 46, delay: '-2s', duration: '30s' },
  { left: '52%', top: '8%', size: 28, delay: '-12s', duration: '26s', gold: true, filled: true },
  { left: '63%', top: '58%', size: 62, delay: '-6s', duration: '32s' },
  { left: '74%', top: '18%', size: 36, delay: '-15s', duration: '24s' },
  { left: '84%', top: '68%', size: 24, delay: '-3s', duration: '27s', filled: true },
  { left: '92%', top: '30%', size: 48, delay: '-8s', duration: '29s', gold: true },
  { left: '10%', top: '84%', size: 20, delay: '-18s', duration: '23s' },
  { left: '47%', top: '40%', size: 16, delay: '-5s', duration: '25s', filled: true },
  { left: '69%', top: '88%', size: 30, delay: '-14s', duration: '31s' },
]

export function BackgroundDecor({
  className,
  showGrid = true,
}: {
  className?: string
  showGrid?: boolean
}) {
  return (
    <div
      aria-hidden
      className={cn('absolute inset-0 overflow-hidden', className)}
    >
      {showGrid && (
        <div className="bg-grid-faint absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_120%_80%_at_50%_0%,black,transparent_75%)]" />
      )}

      {/* Warm bloom that anchors the light source. */}
      <div className="absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px] dark:bg-primary/15" />
      <div className="absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-primary/5 blur-[120px]" />

      {BOXES.map((box, index) => (
        <span
          key={index}
          className={cn(
            'animate-drift absolute rounded-lg',
            box.filled
              ? 'bg-primary/[0.05] dark:bg-primary/[0.07]'
              : 'border border-foreground/[0.06] dark:border-foreground/[0.08]',
            box.gold && 'border-primary/20 dark:border-primary/25'
          )}
          style={{
            left: box.left,
            top: box.top,
            width: box.size,
            height: box.size,
            animationDelay: box.delay,
            animationDuration: box.duration,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  )
}
