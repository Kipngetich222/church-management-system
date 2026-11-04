import Link from 'next/link'

export default function VisitorNotFound() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Welcome link not found</h1>
      <p className="text-muted-foreground">
        Please scan the visitor QR code again or ask the church welcome team for
        help.
      </p>
      <Link href="/churches" className="text-primary underline">
        Find a church
      </Link>
    </main>
  )
}
