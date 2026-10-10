import { getActiveChurch } from '@/lib/utils/church-scope'
import { PageBackdrop } from '@/components/backgrounds/page-backdrop'
import { MemberSidebar } from '@/components/layout/MemberSidebar'
import { MemberTopbar } from '@/components/layout/MemberTopbar'
import { SidebarProvider } from '@/components/layout/sidebar-context'
import { isAdminRole } from '@/lib/auth/redirect'

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getActiveChurch()
  const isAdmin = isAdminRole(ctx.role)

  return (
    <SidebarProvider>
      <div className="relative min-h-screen md:grid md:grid-cols-[auto_1fr]">
        <PageBackdrop variant="dashboard" />

        <MemberSidebar churchName={ctx.church?.name} />

        <div className="relative z-10 flex min-h-screen flex-col">
          <MemberTopbar
            isAdmin={isAdmin}
            memberships={ctx.memberships}
            activeChurchId={ctx.churchId}
          />
          <main className="flex-1 bg-muted/10 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}