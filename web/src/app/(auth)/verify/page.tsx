import { Suspense } from 'react'
import { VerifyEmailCard } from '@/components/auth/VerifyEmailCard'

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailCard />
    </Suspense>
  )
}