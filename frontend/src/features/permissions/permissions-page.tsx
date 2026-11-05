import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { groupByModule } from "@/api/mappers";
import { usePermissions } from "@/api/queries";
import { EmptyState, PermissionKey, QueryError, RowsSkeleton } from "@/components/data/states";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Read-only catalogue: permissions are defined by the code and assigned through the role matrix.
export default function PermissionsPage() {
  const { t } = useTranslation();
  const query = usePermissions();

  return (
    <div className="space-y-6">
      <PageHeader title={t("permissions.title")} description={t("permissions.description")} />
      {query.isPending ? (
        <RowsSkeleton rows={6} />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState icon={KeyRound} title={t("permissions.empty_title")} description={t("permissions.empty_description")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groupByModule(query.data).map((module) => (
            <Card key={module.module}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-baseline gap-2">
                  {/* permissions.modules.dashboard | users | roles | permissions | activity_logs | login_history */}
                  {t(`permissions.modules.${module.module}`, { defaultValue: module.module })}
                  <code className="font-mono text-xs font-normal text-muted-foreground">{module.module}</code>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {module.permissions.map((permission) => (
                    <li key={permission.key} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm">{permission.description}</span>
                      <PermissionKey value={permission.key} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
