'use client'

import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'

/** Lets an admin jump to any occurrence of a recurring service. */
export function ServiceRegisterDatePicker({
  basePath,
  value,
}: {
  basePath: string
  value: string
}) {
  const router = useRouter()
  return (
    <Input
      type="date"
      value={value}
      className="w-44"
      onChange={(e) => router.push(`${basePath}?date=${e.target.value}`)}
    />
  )
}
