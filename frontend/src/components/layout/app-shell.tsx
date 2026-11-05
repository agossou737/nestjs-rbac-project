import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { allNavItems } from "./nav-config";
import { UserMenu } from "./user-menu";

export function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const content = useRef<HTMLDivElement>(null);
  const current = allNavItems.find((item) => pathname.startsWith(item.to));

  // WCAG: after a route change, focus goes to the page heading so screen readers announce the new screen.
  useEffect(() => {
    const frame = requestAnimationFrame(() => content.current?.querySelector<HTMLElement>("h1")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
          <SidebarTrigger className="-ml-1 min-h-11 min-w-11" aria-label={t("nav.toggle_sidebar")} />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {current ? t(`nav.items.${current.key}`) : t("common.app_name")}
          </span>
          <UserMenu />
        </header>
        <div ref={content} className="flex-1 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
