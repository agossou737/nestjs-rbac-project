import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { fullName, type ActivityLog } from "@/api/mappers";
import { useActivityLogs } from "@/api/queries";
import { useSession } from "@/app/session";
import { useActionLabel } from "@/components/data/activity";
import { DateRangeFilter } from "@/components/data/date-range-filter";
import { ListPagination } from "@/components/data/list-pagination";
import { EmptyState, QueryError, RowsSkeleton } from "@/components/data/states";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dayEndIso, dayStartIso, formatDateTime, formatNumber } from "@/lib/format";
import { useListParams } from "@/lib/use-list-params";

const PAGE_SIZE = 25;
const FILTERS = ["action", "entity_type", "from", "to"] as const;
const ALL = "all";
// Mirrors the action codes written by the API (users, roles and auth services).
const ACTIONS = [
  "user.created",
  "user.updated",
  "user.status_changed",
  "user.roles_changed",
  "user.password_reset_requested",
  "user.deleted",
  "role.created",
  "role.duplicated",
  "role.updated",
  "role.permissions_changed",
  "role.deleted",
  "auth.logout",
  "auth.password_reset",
  "auth.login_blocked",
  "auth.account_locked",
  "auth.session_revoked",
];

// The log is read-only by construction: no screen and no API route can change it.
export default function ActivityLogsPage() {
  const { t } = useTranslation();
  const actionLabel = useActionLabel();
  const list = useListParams(FILTERS);
  const { update } = list;
  const query = useActivityLogs({
    page: list.page,
    page_size: PAGE_SIZE,
    action: list.filters.action,
    entity_type: list.filters.entity_type,
    from: dayStartIso(list.filters.from),
    to: dayEndIso(list.filters.to),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("activity.title")}
        description={query.data ? t("activity.count", { count: query.data.total, formatted: formatNumber(query.data.total) }) : t("activity.description")}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full space-y-1 sm:w-64">
          <Label htmlFor="activity-action">{t("activity.filters.action")}</Label>
          <Select value={list.filters.action ?? ALL} onValueChange={(value) => update({ action: value === ALL ? undefined : value })}>
            <SelectTrigger id="activity-action" className="min-h-11 w-full sm:min-h-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("activity.filters.all_actions")}</SelectItem>
              {ACTIONS.map((action) => (
                <SelectItem key={action} value={action}>
                  {actionLabel(action)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1 sm:w-44">
          <Label htmlFor="activity-entity">{t("activity.filters.entity")}</Label>
          <Select value={list.filters.entity_type ?? ALL} onValueChange={(value) => update({ entity_type: value === ALL ? undefined : value })}>
            <SelectTrigger id="activity-entity" className="min-h-11 w-full sm:min-h-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("activity.filters.all_entities")}</SelectItem>
              <SelectItem value="user">{t("activity.entities.user")}</SelectItem>
              <SelectItem value="role">{t("activity.entities.role")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DateRangeFilter idPrefix="activity" from={list.filters.from} to={list.filters.to} onChange={update} />
      </div>

      {query.isPending ? (
        <RowsSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={t(list.hasFilters ? "activity.empty_filtered_title" : "activity.empty_title")}
          description={t(list.hasFilters ? "activity.empty_filtered_description" : "activity.empty_description")}
          action={
            list.hasFilters && (
              <Button variant="outline" className="min-h-11 sm:min-h-0" onClick={list.reset}>
                {t("common.reset_filters")}
              </Button>
            )
          }
        />
      ) : (
        <div>
          <div className="hidden overflow-x-auto rounded-md border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("activity.columns.date")}</TableHead>
                  <TableHead>{t("activity.columns.actor")}</TableHead>
                  <TableHead>{t("activity.columns.action")}</TableHead>
                  <TableHead>{t("activity.columns.target")}</TableHead>
                  <TableHead>{t("activity.columns.details")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      <time dateTime={log.created_at}>{formatDateTime(log.created_at)}</time>
                    </TableCell>
                    <TableCell>{log.actor ? fullName(log.actor) : t("activity.system_actor")}</TableCell>
                    <TableCell>{actionLabel(log.action)}</TableCell>
                    <TableCell>
                      <Target log={log} />
                    </TableCell>
                    <TableCell className="max-w-72">
                      <Details log={log} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {query.data.items.map((log) => (
              <li key={log.id}>
                <Card size="sm">
                  <CardContent className="space-y-1">
                    <p className="text-sm font-medium">{actionLabel(log.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.actor ? fullName(log.actor) : t("activity.system_actor")}, <time dateTime={log.created_at}>{formatDateTime(log.created_at)}</time>
                    </p>
                    <Target log={log} />
                    <Details log={log} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <ListPagination page={list.page} pageSize={PAGE_SIZE} total={query.data.total} onPage={(page) => update({ page }, false)} />
        </div>
      )}
    </div>
  );
}

function Target({ log }: { log: ActivityLog }) {
  const { t } = useTranslation();
  const { can } = useSession();
  // activity.entities.user | role
  const type = t(`activity.entities.${log.entity_type}`, { defaultValue: log.entity_type });
  if (!log.entity_id) return <span className="text-sm text-muted-foreground">{type}</span>;
  const href = log.entity_type === "user" && can("users.read") ? `/users/${log.entity_id}` : log.entity_type === "role" && can("roles.read") ? `/roles/${log.entity_id}` : null;
  return href && !log.action.endsWith(".deleted") ? (
    <Link to={href} className="inline-flex min-h-11 items-center sm:min-h-0 text-sm text-primary underline-offset-4 hover:underline">
      {type}
    </Link>
  ) : (
    <span className="text-sm">{type}</span>
  );
}

function Details({ log }: { log: ActivityLog }) {
  const { t } = useTranslation();
  const entries = Object.entries(log.metadata ?? {});
  if (entries.length === 0) return null;
  return (
    <dl className="space-y-0.5 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1">
          {/* activity.meta.added | removed | fields | from | to | name | roles | permissions | source_name */}
          <dt className="text-muted-foreground">{t(`activity.meta.${key}`, { defaultValue: key })} :</dt>
          <dd className="min-w-0 break-words">{Array.isArray(value) ? value.join(", ") || "-" : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
