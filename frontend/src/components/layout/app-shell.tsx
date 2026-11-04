import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { allNavItems } from "./nav-config";

export function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const current = allNavItems.find((item) => pathname.startsWith(item.to));

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
          <SidebarTrigger className="-ml-1 min-h-11 min-w-11" aria-label={t("nav.toggle_sidebar")} />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center" />
          <span className="truncate text-sm font-medium">
            {current ? t(`nav.items.${current.key}`) : t("common.app_name")}
          </span>
        </header>
        <div className="flex-1 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
