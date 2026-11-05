import { createBrowserRouter, type RouteObject } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { AuthLayout } from "@/components/layout/auth-layout";
import { NotFoundPage, RouteError } from "./error-pages";
import { GuestOnly, HomeRedirect, RequireAuth, RequirePermission } from "./guards";

type ScreenModule = Promise<{ default: React.ComponentType }>;

// One lazily loaded chunk per screen, behind its permission, with its own error boundary.
function screen(path: string, permission: string, load: () => ScreenModule): RouteObject {
  return {
    path,
    element: <RequirePermission permission={permission} />,
    errorElement: <RouteError />,
    children: [{ index: true, lazy: () => load().then((m) => ({ Component: m.default })) }],
  };
}

const lazyPage = (load: () => ScreenModule) => () => load().then((m) => ({ Component: m.default }));

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", lazy: lazyPage(() => import("@/features/auth/login-page")) },
          { path: "/forgot-password", lazy: lazyPage(() => import("@/features/auth/forgot-password-page")) },
        ],
      },
    ],
  },
  {
    // Reachable signed in or not: the link comes by email.
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [{ path: "/reset-password", lazy: lazyPage(() => import("@/features/auth/reset-password-page")) }],
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: <HomeRedirect /> },
          screen("/dashboard", "dashboard.read", () => import("@/features/dashboard/dashboard-page")),
          screen("/users", "users.read", () => import("@/features/users/users-page")),
          screen("/users/:id", "users.read", () => import("@/features/users/user-detail-page")),
          screen("/roles", "roles.read", () => import("@/features/roles/roles-page")),
          screen("/roles/:id", "roles.read", () => import("@/features/roles/role-detail-page")),
          screen("/permissions", "permissions.read", () => import("@/features/permissions/permissions-page")),
          screen("/activity-logs", "activity_logs.read", () => import("@/features/activity-logs/activity-logs-page")),
          screen("/login-history", "login_history.read", () => import("@/features/login-history/login-history-page")),
          ...(import.meta.env.DEV
            ? [{ path: "/design-system", lazy: lazyPage(() => import("@/features/design-system/design-system-page")) }]
            : []),
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
