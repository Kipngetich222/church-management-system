import { getActiveChurch } from '@/lib/utils/church-scope'
import { PageBackdrop } from '@/components/backgrounds/page-backdrop'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { AdminTopbar } from '@/components/layout/AdminTopbar'
import { SidebarProvider } from '@/components/layout/sidebar-context'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getActiveChurch()

  return (
    <SidebarProvider>
      <div className="relative min-h-screen md:grid md:grid-cols-[auto_1fr]">
        <PageBackdrop variant="dashboard" />

        <AdminSidebar
          churchId={ctx.churchId}
          role={ctx.role}
          churchName={ctx.church?.name}
        />

        <div className="relative z-10 flex min-h-screen flex-col">
          <AdminTopbar
            user={{
              email: ctx.user.email!,
              full_name: (ctx.user.user_metadata?.full_name as string) ?? null,
              avatar_url: (ctx.user.user_metadata?.avatar_url as string) ?? null,
            }}
            memberships={ctx.memberships}
            activeChurchId={ctx.churchId}
          />
          <main className="flex-1 bg-muted/10 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}