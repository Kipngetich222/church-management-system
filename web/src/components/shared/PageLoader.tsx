import { Spinner } from '@/components/ui/spinner'

/**
 * Centered loading state used by route-level `loading.tsx` files while a page
 * (or dashboard shell) is being fetched.
 */
export function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Spinner className="size-6 text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
