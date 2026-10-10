// import { getActiveChurch } from '@/lib/utils/church-scope'
// import { ChurchSwitcher } from '@/components/shared/ChurchSwitcher'
// import Link from 'next/link'

// export default async function AdminLayout({
//   children,
// }: {
//   children: React.ReactNode
// }) {
//   const ctx = await getActiveChurch()

//   return (
//     <div className="min-h-screen grid grid-cols-[240px_1fr]">
//       <aside className="border-r bg-muted/30 p-4 space-y-4">
//         <div className="font-bold text-lg">ChurchMS</div>
//         <ChurchSwitcher
//           memberships={ctx.memberships}
//           activeChurchId={ctx.churchId}
//         />
//         <nav className="space-y-1 text-sm">
//           <Link
//             href="/admin/dashboard"
//             className="block px-3 py-2 rounded hover:bg-muted"
//           >
//             Dashboard
//           </Link>
//           <Link
//             href="/admin/members"
//             className="block px-3 py-2 rounded hover:bg-muted"
//           >
//             Members
//           </Link>
//           <Link
//             href="/admin/events"
//             className="block px-3 py-2 rounded hover:bg-muted"
//           >
//             Events
//           </Link>
//           <Link
//             href="/admin/finance/offerings"
//             className="block px-3 py-2 rounded hover:bg-muted"
//           >
//             Finance
//           </Link>
//           <Link
//             href="/admin/settings/church-profile"
//             className="block px-3 py-2 rounded hover:bg-muted"
//           >
//             Settings
//           </Link>
//         </nav>
//       </aside>
//       <main className="p-8">{children}</main>
//     </div>
//   )
// }

import { getActiveChurch } from '@/lib/utils/church-scope'
import { Sidebar } from '@/components/layout/Sidebar'
import { AdminTopbar } from '@/components/layout/AdminTopbar'
import { PageBackdrop } from '@/components/backgrounds/page-backdrop'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getActiveChurch()

  return (
    <div className="relative min-h-screen grid grid-cols-[260px_1fr]">
      <PageBackdrop variant="dashboard" />
      <aside className="relative z-10 border-r bg-muted/20 backdrop-blur-md flex flex-col h-screen sticky top-0">
        <div className="h-14 border-b flex items-center px-4 font-bold text-lg">
          <span className="text-primary mr-1">✝</span> ChurchMS
        </div>
        <Sidebar />
      </aside>

      <div className="relative z-10 flex flex-col min-h-screen">
        <AdminTopbar
          user={{
            email: ctx.user.email!,
            full_name: (ctx.user.user_metadata?.full_name as string) ?? null,
            avatar_url: (ctx.user.user_metadata?.avatar_url as string) ?? null,
          }}
          memberships={ctx.memberships}
          activeChurchId={ctx.churchId}
        />
        <main className="flex-1 p-8 bg-muted/10">{children}</main>
      </div>
    </div>
  )
}
