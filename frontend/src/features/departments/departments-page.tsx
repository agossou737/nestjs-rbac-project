import { Building2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { fullName, type Department } from "@/api/mappers";
import { problemMessage } from "@/api/problem";
import { useDeleteDepartment, useDepartments } from "@/api/queries";
import { useSession } from "@/app/session";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { ListPagination } from "@/components/data/list-pagination";
import { SortableHead } from "@/components/data/sortable-head";
import { EmptyState, QueryError, RowsSkeleton } from "@/components/data/states";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { useListParams } from "@/lib/use-list-params";
import { DepartmentFormDialog } from "./department-form-dialog";

const PAGE_SIZE = 20;
const FILTERS = ["search"] as const;
type DepartmentSort = "name" | "code" | "created_at";
const SORTS: DepartmentSort[] = ["name", "code", "created_at"];

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const list = useListParams(FILTERS);
  const { update } = list;
  const sort = SORTS.find((field) => field === list.sort) ?? "name";
  const query = useDepartments({ page: list.page, page_size: PAGE_SIZE, search: list.filters.search, sort, order: list.order });

  const [search, setSearch] = useState(list.filters.search ?? "");
  useEffect(() => {
    const timer = setTimeout(() => update({ search: search.trim() }), 300);
    return () => clearTimeout(timer);
  }, [search, update]);

  const createButton = can("departments.create") && (
    <DepartmentFormDialog
      trigger={
        <Button className="min-h-11 sm:min-h-0">
          <Plus aria-hidden="true" />
          {t("departments.create")}
        </Button>
      }
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("departments.title")}
        description={query.data ? t("departments.count", { count: query.data.total, formatted: formatNumber(query.data.total) }) : t("departments.description")}
        actions={query.data?.total === 0 && !list.hasFilters ? undefined : createButton}
      />
      <div className="max-w-sm space-y-1">
        <Label htmlFor="department-search">{t("departments.search")}</Label>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="department-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("departments.search_placeholder")}
            className="min-h-11 pl-8 sm:min-h-0"
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
            icon={Building2}
            title={t("departments.empty_filtered_title")}
            description={t("departments.empty_filtered_description")}
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
          // The empty-state action replaces the header action while the list is empty (one primary action per view).
          <EmptyState icon={Building2} title={t("departments.empty_title")} description={t("departments.empty_description")} action={createButton} />
        )
      ) : (
        <div>
          <div className="hidden overflow-x-auto rounded-md border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="code" sort={sort} order={list.order} onSort={list.toggleSort}>
                    {t("departments.fields.code_short")}
                  </SortableHead>
                  <SortableHead field="name" sort={sort} order={list.order} onSort={list.toggleSort}>
                    {t("departments.columns.name")}
                  </SortableHead>
                  <TableHead>{t("departments.columns.manager")}</TableHead>
                  <TableHead className="text-right">{t("departments.columns.members")}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell className="font-mono font-medium">{department.code}</TableCell>
                    <TableCell className="max-w-72">
                      <span className="block truncate">{department.name}</span>
                      {department.description && <span className="block truncate text-xs text-muted-foreground">{department.description}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{department.manager ? fullName(department.manager) : t("departments.no_manager")}</TableCell>
                    <TableCell className="text-right">
                      <MembersLink department={department} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DepartmentActions department={department} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {query.data.items.map((department) => (
              <li key={department.id}>
                <Card size="sm">
                  <CardContent className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-mono text-sm font-medium">{department.code}</p>
                      <p className="truncate text-sm">{department.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {department.manager ? fullName(department.manager) : t("departments.no_manager")}
                      </p>
                      <MembersLink department={department} />
                    </div>
                    <DepartmentActions department={department} />
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

// The members are the users list, filtered: no second screen to keep in sync.
function MembersLink({ department }: { department: Department }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const label = t("departments.members", { count: department.users_count, formatted: formatNumber(department.users_count) });
  return can("users.read") && department.users_count > 0 ? (
    <Link
      to={`/users?department_id=${department.id}`}
      className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline sm:min-h-0"
    >
      {label}
    </Link>
  ) : (
    <span className="text-sm text-muted-foreground">{label}</span>
  );
}

function DepartmentActions({ department }: { department: Department }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useDeleteDepartment();
  const canEdit = can("departments.update");
  const canDelete = can("departments.delete");
  if (!canEdit && !canDelete) return null;

  const onDelete = async () => {
    try {
      await remove.mutateAsync([department.id]);
      toast.success(t("departments.deleted", { code: department.code }));
    } catch (error) {
      toast.error(problemMessage(t, error, { 409: "departments.errors.has_members" }));
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {canEdit && (
        <DepartmentFormDialog
          department={department}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
              aria-label={t("departments.edit", { code: department.code })}
            >
              <Pencil aria-hidden="true" />
            </Button>
          }
        />
      )}
      {canDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
              aria-label={t("departments.more_actions", { code: department.code })}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem variant="destructive" disabled={department.users_count > 0} onSelect={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" />
              <span className="flex flex-col">
                {t("departments.delete")}
                {department.users_count > 0 && <span className="text-xs text-muted-foreground">{t("departments.delete_blocked")}</span>}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("departments.confirm_title", { code: department.code })}
        description={t("departments.confirm_description")}
        confirmLabel={t("departments.delete")}
        destructive
        pending={remove.isPending}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
