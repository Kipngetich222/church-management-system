// import { getActiveChurch } from '@/lib/utils/church-scope'
// import Link from 'next/link'

// export default async function MemberLayout({
//   children,
// }: {
//   children: React.ReactNode
// }) {
//   const ctx = await getActiveChurch()

//   return (
//     <div className="min-h-screen grid grid-cols-[240px_1fr]">
//       <aside className="border-r bg-muted/30 p-4 space-y-4">
//         <div className="font-bold text-lg">{ctx.church?.name}</div>
//         <nav className="space-y-1 text-sm">
//           <Link href="/member/home" className="block px-3 py-2 rounded hover:bg-muted">
//             Home
//           </Link>
//           <Link href="/member/calendar" className="block px-3 py-2 rounded hover:bg-muted">
//             Calendar
//           </Link>
//           <Link href="/member/giving" className="block px-3 py-2 rounded hover:bg-muted">
//             Giving
//           </Link>
//           <Link href="/member/prayer" className="block px-3 py-2 rounded hover:bg-muted">
//             Prayer
//           </Link>
//           <Link href="/member/profile" className="block px-3 py-2 rounded hover:bg-muted">
//             Profile
//           </Link>
//         </nav>
//       </aside>
//       <main className="p-8">{children}</main>
//     </div>
//   )
// }

import { getActiveChurch } from '@/lib/utils/church-scope'
import { MemberTopbar } from '@/components/layout/MemberTopbar'
import { isAdminRole } from '@/lib/auth/redirect'
import Link from 'next/link'

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getActiveChurch()
  const isAdmin = isAdminRole(ctx.role)

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r bg-muted/20 p-4 space-y-4">
        <div className="font-bold text-lg">{ctx.church?.name}</div>
        <nav className="space-y-1 text-sm">
          <Link
            href="/member/home"
            className="block px-3 py-2 rounded hover:bg-muted"
          >
            Home
          </Link>
          <Link
            href="/member/calendar"
            className="block px-3 py-2 rounded hover:bg-muted"
          >
            Calendar
          </Link>
          <Link
            href="/member/giving"
            className="block px-3 py-2 rounded hover:bg-muted"
          >
            Giving
          </Link>
          <Link
            href="/member/prayer"
            className="block px-3 py-2 rounded hover:bg-muted"
          >
            Prayer
          </Link>
          <Link href="/member/resources" className="block px-3 py-2 rounded hover:bg-muted">Resources</Link>
<Link href="/member/volunteering" className="block px-3 py-2 rounded hover:bg-muted">Volunteering</Link>
          <Link
            href="/member/profile"
            className="block px-3 py-2 rounded hover:bg-muted"
          >
            Profile
          </Link>
        </nav>
      </aside>
      <div className="flex flex-col">
        <MemberTopbar
          isAdmin={isAdmin}
          memberships={ctx.memberships}
          activeChurchId={ctx.churchId}
        />
        <main className="flex-1 p-8 bg-muted/10">{children}</main>
      </div>
    </div>
  )
}
