import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Lock, ShieldOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import type { PermissionKey, RoleDetail } from "@/api/mappers";
import { applyFieldErrors, problemMessage, toProblem } from "@/api/problem";
import { usePermissions, useRole, useSetRolePermissions, useUpdateRole } from "@/api/queries";
import { useSession } from "@/app/session";
import { EmptyState, QueryError, RowsSkeleton } from "@/components/data/states";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { PermissionMatrix } from "./permission-matrix";
import { RoleActions } from "./role-actions";
import { RoleFields, roleSchema, type RoleValues } from "./role-form";

const SUPER_ADMIN = "Super Administrator";

export default function RoleDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const query = useRole(id);

  if (query.isPending) return <RowsSkeleton rows={6} />;
  if (query.isError) {
    if (toProblem(query.error).status === 404) {
      return <EmptyState icon={ShieldOff} title={t("roles.detail.not_found_title")} description={t("roles.detail.not_found_description")} action={<BackLink />} />;
    }
    return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <RoleDetailView role={query.data} />;
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Button asChild variant="ghost" className="min-h-11 sm:min-h-0">
      <Link to="/roles">
        <ArrowLeft aria-hidden="true" />
        {t("roles.detail.back")}
      </Link>
    </Button>
  );
}

function RoleDetailView({ role }: { role: RoleDetail }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title={role.name}
        description={t("roles.card_counts", { users: role.users_count, permissions: role.permissions_count })}
        actions={
          <div className="flex items-center gap-2">
            {role.is_system && <Badge variant="outline">{t("roles.system")}</Badge>}
            <RoleActions role={role} afterDelete="/roles" />
          </div>
        }
      />
      <InfoCard role={role} />
      {/* Keyed by the saved keys: a save or a refetch resets the local selection. */}
      <MatrixCard key={role.permissions.join(",")} role={role} />
    </div>
  );
}

function InfoCard({ role }: { role: RoleDetail }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const update = useUpdateRole();
  const editable = can("roles.update");
  const form = useForm<RoleValues>({
    resolver: zodResolver(roleSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    values: { name: role.name, description: role.description ?? "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync([role.id, role.is_system ? { description: values.description } : values]);
      toast.success(t("roles.detail.saved"));
    } catch (error) {
      if (applyFieldErrors(error, form.setError, ["name", "description"])) return;
      if (toProblem(error).status === 409) form.setError("name", { type: "server", message: "roles.errors.name_taken" });
      else toast.error(problemMessage(t, error));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("roles.detail.info_title")}</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent>
          <FieldGroup className="max-w-xl">
            <RoleFields form={form} nameLocked={role.is_system} disabled={!editable} />
          </FieldGroup>
        </CardContent>
        {editable && (
          <CardFooter className="pt-4">
            <Button type="submit" className="min-h-11 sm:min-h-0" disabled={update.isPending || !form.formState.isDirty}>
              {t("common.save")}
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}

function MatrixCard({ role }: { role: RoleDetail }) {
  const { t } = useTranslation();
  const { can, me } = useSession();
  const catalogue = usePermissions();
  const save = useSetRolePermissions();
  const [selected, setSelected] = useState<PermissionKey[]>(role.permissions);
  const frozen = role.name === SUPER_ADMIN;
  const readOnly = frozen || !can("roles.update");
  const dirty = [...selected].sort().join(",") !== role.permissions.join(",");
  const heldByMe = me?.roles.some((r) => r.id === role.id) ?? false;

  // Awaited rather than mutate callbacks: saving remounts this card (keyed by the saved permissions).
  const onSave = async () => {
    try {
      await save.mutateAsync([role.id, selected]);
      toast.success(t("roles.matrix.saved"));
    } catch (error) {
      toast.error(problemMessage(t, error, { 403: "roles.errors.grant_forbidden" }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("roles.matrix.title")}</CardTitle>
        <CardDescription>{t("roles.matrix.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {frozen && (
          <Alert>
            <Lock aria-hidden="true" />
            <AlertDescription>{t("roles.matrix.frozen")}</AlertDescription>
          </Alert>
        )}
        {heldByMe && !readOnly && (
          <Alert>
            <AlertDescription>{t("roles.matrix.own_role")}</AlertDescription>
          </Alert>
        )}
        {catalogue.isPending ? (
          <RowsSkeleton rows={6} />
        ) : catalogue.isError ? (
          <QueryError error={catalogue.error} onRetry={() => void catalogue.refetch()} />
        ) : (
          <PermissionMatrix catalogue={catalogue.data} value={selected} onChange={setSelected} readOnly={readOnly} />
        )}
      </CardContent>
      {!readOnly && (
        <CardFooter className="flex flex-wrap gap-2 pt-4">
          <Button className="min-h-11 sm:min-h-0" onClick={onSave} disabled={!dirty || save.isPending}>
            {t("roles.matrix.save")}
          </Button>
          <Button variant="ghost" className="min-h-11 sm:min-h-0" onClick={() => setSelected(role.permissions)} disabled={!dirty || save.isPending}>
            {t("roles.matrix.reset")}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
