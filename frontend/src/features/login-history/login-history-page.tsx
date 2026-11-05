import { History, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { LoginAttempt } from "@/api/mappers";
import { useLoginHistory } from "@/api/queries";
import { useSession } from "@/app/session";
import { DateRangeFilter } from "@/components/data/date-range-filter";
import { ListPagination } from "@/components/data/list-pagination";
import { LoginOutcomeBadge } from "@/components/data/login-outcome-badge";
import { EmptyState, QueryError, RowsSkeleton } from "@/components/data/states";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dayEndIso, dayStartIso, formatDateTime, formatNumber } from "@/lib/format";
import { useListParams } from "@/lib/use-list-params";

const PAGE_SIZE = 25;
const FILTERS = ["email", "outcome", "from", "to"] as const;
const OUTCOMES: LoginAttempt["outcome"][] = ["SUCCESS", "INVALID_CREDENTIALS", "ACCOUNT_LOCKED", "ACCOUNT_INACTIVE"];
const ALL = "all";

export default function LoginHistoryPage() {
  const { t } = useTranslation();
  const list = useListParams(FILTERS);
  const { update } = list;
  const outcome = OUTCOMES.find((value) => value === list.filters.outcome);
  const query = useLoginHistory({
    page: list.page,
    page_size: PAGE_SIZE,
    email: list.filters.email,
    outcome,
    from: dayStartIso(list.filters.from),
    to: dayEndIso(list.filters.to),
  });
  const [email, setEmail] = useState(list.filters.email ?? "");
  useEffect(() => {
    const timer = setTimeout(() => update({ email: email.trim() }), 300);
    return () => clearTimeout(timer);
  }, [email, update]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("logins.title")}
        description={query.data ? t("logins.count", { count: query.data.total, formatted: formatNumber(query.data.total) }) : t("logins.description")}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-56 space-y-1">
          <Label htmlFor="logins-email">{t("logins.filters.email")}</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="logins-email" type="search" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11 pl-8 sm:min-h-0" />
          </div>
        </div>
        <div className="w-full space-y-1 sm:w-52">
          <Label htmlFor="logins-outcome">{t("logins.filters.outcome")}</Label>
          <Select value={outcome ?? ALL} onValueChange={(value) => update({ outcome: value === ALL ? undefined : value })}>
            <SelectTrigger id="logins-outcome" className="min-h-11 w-full sm:min-h-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("logins.filters.all_outcomes")}</SelectItem>
              {OUTCOMES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`logins.outcome.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DateRangeFilter idPrefix="logins" from={list.filters.from} to={list.filters.to} onChange={update} />
      </div>

      {query.isPending ? (
        <RowsSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={History}
          title={t(list.hasFilters ? "logins.empty_filtered_title" : "logins.empty_title")}
          description={t(list.hasFilters ? "logins.empty_filtered_description" : "logins.empty_description")}
          action={
            list.hasFilters && (
              <Button
                variant="outline"
                className="min-h-11 sm:min-h-0"
                onClick={() => {
                  setEmail("");
                  list.reset();
                }}
              >
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
                  <TableHead>{t("logins.columns.date")}</TableHead>
                  <TableHead>{t("logins.columns.email")}</TableHead>
                  <TableHead>{t("logins.columns.outcome")}</TableHead>
                  <TableHead>{t("logins.columns.ip")}</TableHead>
                  <TableHead>{t("logins.columns.agent")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      <time dateTime={attempt.created_at}>{formatDateTime(attempt.created_at)}</time>
                    </TableCell>
                    <TableCell>
                      <AttemptEmail attempt={attempt} />
                    </TableCell>
                    <TableCell>
                      <LoginOutcomeBadge outcome={attempt.outcome} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{attempt.ip_address ?? t("logins.unknown_ip")}</TableCell>
                    <TableCell className="max-w-64 truncate text-xs text-muted-foreground" title={attempt.user_agent ?? undefined}>
                      {attempt.user_agent}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {query.data.items.map((attempt) => (
              <li key={attempt.id}>
                <Card size="sm">
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <AttemptEmail attempt={attempt} />
                      <LoginOutcomeBadge outcome={attempt.outcome} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={attempt.created_at}>{formatDateTime(attempt.created_at)}</time>
                      {" - "}
                      <span className="font-mono">{attempt.ip_address ?? t("logins.unknown_ip")}</span>
                    </p>
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

function AttemptEmail({ attempt }: { attempt: LoginAttempt }) {
  const { can } = useSession();
  return attempt.user_id && can("users.read") ? (
    <Link to={`/users/${attempt.user_id}`} className="inline-flex min-h-11 items-center sm:min-h-0 min-w-0 truncate text-sm text-primary underline-offset-4 hover:underline">
      {attempt.email}
    </Link>
  ) : (
    <span className="min-w-0 truncate text-sm">{attempt.email}</span>
  );
}
