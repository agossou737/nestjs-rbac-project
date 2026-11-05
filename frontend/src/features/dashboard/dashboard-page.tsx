import { Activity } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { Dashboard } from "@/api/mappers";
import { useDashboard } from "@/api/queries";
import { useSession } from "@/app/session";
import { ActivityLine } from "@/components/data/activity";
import { EmptyState, QueryError } from "@/components/data/states";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay, formatNumber } from "@/lib/format";

export default function DashboardPage() {
  const { t } = useTranslation();
  const query = useDashboard();

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} />
      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DashboardContent data={query.data} />
      )}
    </div>
  );
}

function DashboardContent({ data }: { data: Dashboard }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const usersLink = (status?: string) => (can("users.read") ? `/users${status ? `?status=${status}` : ""}` : undefined);
  const maxRole = Math.max(1, ...data.users_by_role.map((row) => row.count));
  const loginTotal = data.logins_by_day.reduce((sum, day) => sum + day.success + day.failure, 0);

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-3" aria-label={t("dashboard.indicators")}>
        {/* The memorable element: active accounts set large, the other figures quieter (ui.md, ECR-004). */}
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardDescription>{t("dashboard.active_users")}</CardDescription>
            <CardTitle className="font-mono text-3xl font-semibold tabular-nums">
              <Figure to={usersLink("ACTIVE")} value={data.users.active} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.active_share", { active: formatNumber(data.users.active), total: formatNumber(data.users.total) })}
            </p>
          </CardContent>
        </Card>
        <SmallFigure label={t("dashboard.inactive_users")} value={data.users.inactive} to={usersLink("INACTIVE")} />
        <SmallFigure label={t("dashboard.locked_users")} value={data.users.locked} to={usersLink("LOCKED")} />
        <SmallFigure label={t("dashboard.roles_total")} value={data.roles_total} to={can("roles.read") ? "/roles" : undefined} />
        <SmallFigure
          label={t("dashboard.permissions_total")}
          value={data.permissions_total}
          to={can("permissions.read") ? "/permissions" : undefined}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.logins_title")}</CardTitle>
          <CardDescription>{t("dashboard.logins_description", { count: loginTotal })}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginsChart data={data.logins_by_day} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.by_role_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.users_by_role.map((row) => (
                <li key={row.role} className="space-y-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{row.role}</span>
                    <span className="font-mono tabular-nums">{formatNumber(row.count)}</span>
                  </div>
                  <progress className="role-bar" max={maxRole} value={row.count} aria-label={row.role} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recent_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recent_activity.length === 0 ? (
              <EmptyState icon={Activity} title={t("dashboard.recent_empty_title")} description={t("dashboard.recent_empty_description")} />
            ) : (
              <ul className="divide-y">
                {data.recent_activity.map((log) => (
                  <li key={log.id} className="py-2 first:pt-0 last:pb-0">
                    <ActivityLine log={log} />
                  </li>
                ))}
              </ul>
            )}
            {can("activity_logs.read") && (
              <Link to="/activity-logs" className="mt-4 inline-flex min-h-11 items-center sm:min-h-0 text-sm text-primary underline-offset-4 hover:underline">
                {t("dashboard.see_all_activity")}
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Figure({ value, to }: { value: number; to?: string }) {
  const text = formatNumber(value);
  return to ? (
    <Link to={to} className="inline-flex min-h-11 min-w-11 items-center underline-offset-4 hover:underline sm:min-h-0 sm:min-w-0">
      {text}
    </Link>
  ) : (
    text
  );
}

function SmallFigure({ label, value, to }: { label: ReactNode; value: number; to?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-xl tabular-nums">
          <Figure value={value} to={to} />
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function LoginsChart({ data }: { data: Dashboard["logins_by_day"] }) {
  const { t } = useTranslation();
  const config = {
    success: { label: t("dashboard.series_success"), color: "var(--chart-1)" },
    failure: { label: t("dashboard.series_failure"), color: "var(--destructive)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={formatDay} minTickGap={16} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatDay(String(value))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="success" stackId="logins" fill="var(--color-success)" />
        <Bar dataKey="failure" stackId="logins" fill="var(--color-failure)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 lg:row-span-2" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
