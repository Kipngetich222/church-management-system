import { PageLoader } from '@/components/shared/PageLoader'

export default function Loading() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <PageLoader />
    </div>
  )
}
