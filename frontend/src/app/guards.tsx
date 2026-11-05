import { Navigate, Outlet, useLocation } from "react-router";
import { allNavItems } from "@/components/layout/nav-config";
import { Skeleton } from "@/components/ui/skeleton";
import { ForbiddenPage } from "./error-pages";
import { useSession } from "./session";

function FullPageSkeleton() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6" aria-busy="true">
      <Skeleton className="h-40 w-full max-w-md" />
    </div>
  );
}

export function RequireAuth() {
  const { status } = useSession();
  const location = useLocation();
  if (status === "restoring") return <FullPageSkeleton />;
  if (status === "anonymous") {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <Outlet />;
}

// Hides a screen the user may not open. The API still refuses the calls: this only avoids a dead end.
export function RequirePermission({ permission }: { permission: string }) {
  const { can } = useSession();
  return can(permission) ? <Outlet /> : <ForbiddenPage />;
}

export function GuestOnly() {
  const { status } = useSession();
  if (status === "restoring") return <FullPageSkeleton />;
  return status === "authenticated" ? <Navigate to="/" replace /> : <Outlet />;
}

export function HomeRedirect() {
  const { can } = useSession();
  const first = allNavItems.find((item) => can(item.permission));
  return first ? <Navigate to={first.to} replace /> : <ForbiddenPage noModule />;
}
