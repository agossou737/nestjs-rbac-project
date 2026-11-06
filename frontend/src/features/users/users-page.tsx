import { Search, UserRoundX, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { UserStatus } from "@/api/endpoints";
import { fullName, initials, type User } from "@/api/mappers";
import { useRoles, useUsers } from "@/api/queries";
import { useSession } from "@/app/session";
import { ListPagination } from "@/components/data/list-pagination";
import { SortableHead } from "@/components/data/sortable-head";
import { EmptyState, QueryError, RowsSkeleton } from "@/components/data/states";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useListParams } from "@/lib/use-list-params";
import { CreateUserDialog } from "./create-user-dialog";
import { DepartmentSelect } from "./department-select";
import { UserActions } from "./user-actions";
import { UserStatusBadge } from "./user-status-badge";

const PAGE_SIZE = 20;
const FILTERS = ["search", "status", "role_id", "department_id"] as const;
const STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE", "LOCKED"];
const ALL = "all";
type UserSort = "created_at" | "email" | "last_name" | "last_login_at" | "status";
const SORTS: UserSort[] = ["created_at", "email", "last_name", "last_login_at", "status"];

export default function UsersPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const list = useListParams(FILTERS);
  const sort = SORTS.find((field) => field === list.sort);
  const status = STATUSES.find((value) => value === list.filters.status);
  const query = useUsers({
    page: list.page,
    page_size: PAGE_SIZE,
    search: list.filters.search,
    status,
    role_id: list.filters.role_id,
    department_id: list.filters.department_id,
    sort,
    order: list.order,
  });
  const roles = useRoles({ page: 1, page_size: 100, sort: "name", order: "asc" });

  const [search, setSearch] = useState(list.filters.search ?? "");
  const { update } = list;
  useEffect(() => {
    const timer = setTimeout(() => update({ search: search.trim() }), 300);
    return () => clearTimeout(timer);
  }, [search, update]);

  const total = query.data?.total;
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("users.title")}
        description={total === undefined ? t("users.description") : t("users.count", { count: total, formatted: formatNumber(total) })}
        actions={can("users.create") && <CreateUserDialog />}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64 space-y-1">
          <Label htmlFor="user-search">{t("users.filters.search")}</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="user-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("users.filters.search_placeholder")}
              className="min-h-11 pl-8 sm:min-h-0"
            />
          </div>
        </div>
        <div className="w-full space-y-1 sm:w-44">
          <Label htmlFor="user-status">{t("users.filters.status")}</Label>
          <Select value={status ?? ALL} onValueChange={(value) => update({ status: value === ALL ? undefined : value })}>
            <SelectTrigger id="user-status" className="min-h-11 w-full sm:min-h-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("users.filters.all_statuses")}</SelectItem>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`users.status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1 sm:w-52">
          <Label htmlFor="user-role">{t("users.filters.role")}</Label>
          <Select value={list.filters.role_id ?? ALL} onValueChange={(value) => update({ role_id: value === ALL ? undefined : value })}>
            <SelectTrigger id="user-role" className="min-h-11 w-full sm:min-h-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("users.filters.all_roles")}</SelectItem>
              {roles.data?.items.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1 sm:w-56">
          <Label htmlFor="user-department">{t("users.filters.department")}</Label>
          <DepartmentSelect
            id="user-department"
            value={list.filters.department_id ?? ""}
            onChange={(value) => update({ department_id: value || undefined })}
            noneLabel={t("users.filters.all_departments")}
          />
        </div>
      </div>

      {query.isPending ? (
        <RowsSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        list.hasFilters ? (
          <EmptyState
            icon={UserRoundX}
            title={t("users.empty.filtered_title")}
            description={t("users.empty.filtered_description")}
            action={
              <Button
                variant="outline"
                className="min-h-11 sm:min-h-0"
                onClick={() => {
                  setSearch("");
                  list.reset();
                }}
              >
                {t("common.reset_filters")}
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Users} title={t("users.empty.title")} description={t("users.empty.description")} />
        )
      ) : (
        <div>
          <div className="hidden overflow-x-auto rounded-md border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="last_name" sort={list.sort} order={list.order} onSort={list.toggleSort}>
                    {t("users.columns.name")}
                  </SortableHead>
                  <SortableHead field="status" sort={list.sort} order={list.order} onSort={list.toggleSort}>
                    {t("users.columns.status")}
                  </SortableHead>
                  <TableHead>{t("users.columns.roles")}</TableHead>
                  <TableHead>{t("users.columns.department")}</TableHead>
                  <SortableHead field="last_login_at" sort={list.sort} order={list.order} onSort={list.toggleSort}>
                    {t("users.columns.last_login")}
                  </SortableHead>
                  <SortableHead field="created_at" sort={list.sort} order={list.order} onSort={list.toggleSort}>
                    {t("users.columns.created")}
                  </SortableHead>
                  <TableHead>
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <UserIdentity user={user} />
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge status={user.status} />
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">
                      {user.roles.map((role) => role.name).join(", ") || t("users.no_role")}
                    </TableCell>
                    <TableCell className="font-mono text-xs" title={user.department?.name}>
                      {user.department?.code ?? <span className="font-sans text-muted-foreground">{t("users.no_department")}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(user.last_login_at) || t("users.never")}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <UserActions user={user} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 md:hidden">
            {query.data.items.map((user) => (
              <li key={user.id}>
                <Card size="sm">
                  <CardContent className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <UserIdentity user={user} />
                      <div className="flex flex-wrap items-center gap-2">
                        <UserStatusBadge status={user.status} />
                        <span className="text-xs text-muted-foreground">{user.roles.map((role) => role.name).join(", ") || t("users.no_role")}</span>
                        {user.department && <span className="font-mono text-xs">{user.department.code}</span>}
                      </div>
                    </div>
                    <UserActions user={user} />
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

function UserIdentity({ user }: { user: User }) {
  return (
    <Link to={`/users/${user.id}`} className="group flex min-h-11 min-w-0 items-center gap-3">
      <Avatar className="size-8">
        <AvatarFallback className="bg-accent text-xs text-accent-foreground">{initials(user)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate font-medium group-hover:underline">{fullName(user)}</span>
        <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
      </span>
    </Link>
  );
}
