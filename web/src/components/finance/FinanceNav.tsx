'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
const links = [
  ['Overview & reports', '/admin/finance'],
  ['Giving', '/admin/finance/offerings'],
  ['Transactions', '/admin/finance/transactions'],
  ['Expenses & bills', '/admin/finance/expenses'],
  ['Other income', '/admin/finance/income'],
  ['Pledges', '/admin/finance/pledges'],
  ['Campaigns', '/admin/finance/campaigns'],
  ['Budgets', '/admin/finance/budgets'],
  ['Change history', '/admin/finance/history'],
]
export function FinanceNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Finance" className="flex flex-wrap gap-1 border-b pb-3">
      {links.map(([label, href]) => {
        const active =
          href === '/admin/finance'
            ? pathname === href || pathname === `${href}/reports`
            : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-3 py-2 text-sm ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
