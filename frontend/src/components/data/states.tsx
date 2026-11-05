import { CircleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { problemMessage } from "@/api/problem";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export function QueryError({ error, onRetry, title }: { error: unknown; onRetry: () => void; title?: string }) {
  const { t } = useTranslation();
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{title ?? t("errors.load_failed")}</AlertTitle>
      <AlertDescription>
        <p>{problemMessage(t, error)}</p>
        <Button variant="outline" size="sm" className="mt-2 min-h-11 sm:min-h-0" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

type EmptyStateProps = { icon: LucideIcon; title: string; description: string; action?: ReactNode };

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

// Loading state shaped like the list it stands for.
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-md border bg-card p-4" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PermissionKey({ value }: { value: string }) {
  return <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">{value}</code>;
}
