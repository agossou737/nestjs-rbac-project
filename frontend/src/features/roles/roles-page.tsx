import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import type { Role } from "@/api/mappers";
import { applyFieldErrors, problemMessage, toProblem } from "@/api/problem";
import { useCreateRole, useRoles } from "@/api/queries";
import { useSession } from "@/app/session";
import { ListPagination } from "@/components/data/list-pagination";
import { SortableHead } from "@/components/data/sortable-head";
import { EmptyState, QueryError, RowsSkeleton } from "@/components/data/states";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { useListParams } from "@/lib/use-list-params";
import { RoleActions } from "./role-actions";
import { RoleFields, roleSchema, type RoleValues } from "./role-form";

const PAGE_SIZE = 20;
const FILTERS = ["search"] as const;

export default function RolesPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const list = useListParams(FILTERS);
  const sort = list.sort === "created_at" ? "created_at" : "name";
  const query = useRoles({ page: list.page, page_size: PAGE_SIZE, search: list.filters.search, sort, order: list.order });
  const [search, setSearch] = useState(list.filters.search ?? "");
  const { update } = list;
  useEffect(() => {
    const timer = setTimeout(() => update({ search: search.trim() }), 300);
    return () => clearTimeout(timer);
  }, [search, update]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("roles.title")}
        description={query.data ? t("roles.count", { count: query.data.total, formatted: formatNumber(query.data.total) }) : t("roles.description")}
        actions={can("roles.create") && <CreateRoleDialog />}
      />
      <div className="max-w-sm space-y-1">
        <Label htmlFor="role-search">{t("roles.search")}</Label>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="role-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-11 pl-8 sm:min-h-0" />
        </div>
      </div>

      {query.isPending ? (
        <RowsSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={ShieldOff}
          title={t("roles.empty_title")}
          description={t("roles.empty_description")}
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
        <div>
          <div className="hidden overflow-x-auto rounded-md border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="name" sort={sort} order={list.order} onSort={list.toggleSort}>
                    {t("roles.columns.name")}
                  </SortableHead>
                  <TableHead>{t("roles.columns.description")}</TableHead>
                  <TableHead className="text-right">{t("roles.columns.users")}</TableHead>
                  <TableHead className="text-right">{t("roles.columns.permissions")}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <RoleName role={role} />
                    </TableCell>
                    <TableCell className="max-w-80 truncate text-muted-foreground">{role.description}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatNumber(role.users_count)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatNumber(role.permissions_count)}</TableCell>
                    <TableCell className="text-right">
                      <RoleActions role={role} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {query.data.items.map((role) => (
              <li key={role.id}>
                <Card size="sm">
                  <CardContent className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <RoleName role={role} />
                      <p className="text-xs text-muted-foreground">
                        {t("roles.card_counts", { users: role.users_count, permissions: role.permissions_count })}
                      </p>
                    </div>
                    <RoleActions role={role} />
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

function RoleName({ role }: { role: Role }) {
  const { t } = useTranslation();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Link to={`/roles/${role.id}`} className="inline-flex min-h-11 min-w-11 items-center sm:min-h-0 sm:min-w-0 font-medium hover:underline">
        {role.name}
      </Link>
      {role.is_system && (
        <Badge variant="outline">
          <ShieldCheck aria-hidden="true" />
          {t("roles.system")}
        </Badge>
      )}
    </span>
  );
}

function CreateRoleDialog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const create = useCreateRole();
  const form = useForm<RoleValues>({ resolver: zodResolver(roleSchema), mode: "onBlur", reValidateMode: "onChange", defaultValues: { name: "", description: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const role = await create.mutateAsync([{ name: values.name, description: values.description || undefined, permissions: [] }]);
      toast.success(t("roles.create.done", { name: role.name }));
      setOpen(false);
      form.reset();
      navigate(`/roles/${role.id}`);
    } catch (error) {
      if (applyFieldErrors(error, form.setError, ["name", "description"])) return;
      if (toProblem(error).status === 409) form.setError("name", { type: "server", message: "roles.errors.name_taken" });
      else toast.error(problemMessage(t, error));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="min-h-11 sm:min-h-0">
          <Plus aria-hidden="true" />
          {t("roles.create.action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("roles.create.title")}</DialogTitle>
          <DialogDescription>{t("roles.create.description")}</DialogDescription>
        </DialogHeader>
        <form id="create-role" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <RoleFields form={form} />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form="create-role" className="min-h-11 sm:min-h-0" disabled={create.isPending}>
            {t("roles.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
