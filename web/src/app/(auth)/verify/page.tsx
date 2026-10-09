import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function VerifyPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent you a verification link. Click it to activate your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Back to login
        </Button>
      </CardContent>
    </Card>
  )
}
