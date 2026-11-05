import { CircleAlert, FileQuestion, ShieldX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useRouteError } from "react-router";
import { EmptyState } from "@/components/data/states";
import { Button } from "@/components/ui/button";

export function ForbiddenPage({ noModule = false }: { noModule?: boolean }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={ShieldX}
      title={t(noModule ? "errors.no_module_title" : "errors.forbidden_title")}
      description={t(noModule ? "errors.no_module_description" : "errors.forbidden_description")}
    />
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={FileQuestion}
      title={t("errors.not_found_title")}
      description={t("errors.not_found_description")}
      action={
        <Button asChild variant="outline" className="min-h-11 sm:min-h-0">
          <Link to="/">{t("errors.back_home")}</Link>
        </Button>
      }
    />
  );
}

// errorElement of every route (FE-3): a crash in one screen keeps the shell and the navigation usable.
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="p-4 md:p-6">
      <EmptyState
        icon={CircleAlert}
        title={t("errors.crash_title")}
        description={t("errors.crash_description")}
        action={
          <Button variant="outline" className="min-h-11 sm:min-h-0" onClick={() => window.location.reload()}>
            {t("errors.reload")}
          </Button>
        }
      />
    </div>
  );
}
