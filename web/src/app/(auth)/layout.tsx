import { BackgroundDecor } from '@/components/backgrounds/background-decor'
import { ThemeToggle } from '@/components/theme/theme-toggle'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 p-4">
      <BackgroundDecor className="opacity-70" />
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  )
}