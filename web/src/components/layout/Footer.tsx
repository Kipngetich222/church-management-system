import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <h3 className="font-bold mb-4">ChurchMS</h3>
          <p className="text-sm text-muted-foreground">
            Modern church management for growing congregations.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-4 text-sm">Product</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/features">Features</Link>
            </li>
            <li>
              <Link href="/pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/focus-mode">Focus Mode</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4 text-sm">Community</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/churches">Find a Church</Link>
            </li>
            <li>
              <Link href="/events">Events</Link>
            </li>
            <li>
              <Link href="/prayer-wall">Prayer Wall</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4 text-sm">Company</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/about">About</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ChurchMS. All rights reserved.
      </div>
    </footer>
  )
}
