import { Building2, History, KeyRound, LayoutDashboard, ScrollText, ShieldCheck, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  key: string;
  to: string;
  icon: LucideIcon;
  // Permission required to see the entry; the API stays the only real barrier.
  permission: string;
};

export type NavGroup = { key: string; items: NavItem[] };

// Labels are i18n keys: nav.groups.<group.key> and nav.items.<item.key>.
export const navGroups: NavGroup[] = [
  {
    key: "overview",
    items: [{ key: "dashboard", to: "/dashboard", icon: LayoutDashboard, permission: "dashboard.read" }],
  },
  {
    key: "access",
    items: [
      { key: "users", to: "/users", icon: Users, permission: "users.read" },
      { key: "departments", to: "/departments", icon: Building2, permission: "departments.read" },
      { key: "roles", to: "/roles", icon: ShieldCheck, permission: "roles.read" },
      { key: "permissions", to: "/permissions", icon: KeyRound, permission: "permissions.read" },
    ],
  },
  {
    key: "audit",
    items: [
      { key: "activity_logs", to: "/activity-logs", icon: ScrollText, permission: "activity_logs.read" },
      { key: "login_history", to: "/login-history", icon: History, permission: "login_history.read" },
    ],
  },
];

export const allNavItems = navGroups.flatMap((group) => group.items);
