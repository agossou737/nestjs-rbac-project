import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { allNavItems } from "@/components/layout/nav-config";
import { DesignSystemPage } from "@/features/design-system/design-system-page";
import { ModulePendingPage } from "@/features/placeholder/module-pending-page";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      ...allNavItems.map((item) => ({ path: item.to, element: <ModulePendingPage navKey={item.key} /> })),
      ...(import.meta.env.DEV ? [{ path: "/design-system", element: <DesignSystemPage /> }] : []),
      { path: "*", element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);
