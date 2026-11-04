import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { navGroups } from "./nav-config";

export function AppSidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/dashboard">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <KeyRound className="size-4" aria-hidden="true" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-semibold">{t("common.app_name")}</span>
                  <span className="text-xs text-muted-foreground">{t("common.app_tagline")}</span>
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.key}>
            {/* nav.groups.overview | access | audit */}
            <SidebarGroupLabel>{t(`nav.groups.${group.key}`)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  // nav.items.dashboard | users | roles | permissions | activity_logs | login_history
                  const label = t(`nav.items.${item.key}`);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild isActive={pathname.startsWith(item.to)} tooltip={label}>
                        <NavLink to={item.to}>
                          <item.icon aria-hidden="true" />
                          <span>{label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
