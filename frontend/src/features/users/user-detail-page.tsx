import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, History, ScrollText } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { fullName, type User } from "@/api/mappers";
import { applyFieldErrors, problemMessage, toProblem } from "@/api/problem";
import { useActivityLogs, useLoginHistory, useSetUserRoles, useUpdateUser, useUser } from "@/api/queries";
import { useSession } from "@/app/session";
import { ActivityLine } from "@/components/data/activity";
import { ListPagination } from "@/components/data/list-pagination";
import { LoginOutcomeBadge } from "@/components/data/login-outcome-badge";
import { EmptyState, QueryError, RowsSkeleton } from "@/components/data/states";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import { RoleChecklist } from "./role-checklist";
import { UserActions } from "./user-actions";
import { profileSchema, UserProfileFields, type ProfileValues } from "./user-profile-fields";
import { UserStatusBadge } from "./user-status-badge";

const TABS = ["profile", "roles", "activity", "logins"] as const;
type Tab = (typeof TABS)[number];

export default function UserDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const query = useUser(id);

  if (query.isPending) return <RowsSkeleton rows={4} />;
  if (query.isError) {
    if (toProblem(query.error).status === 404) {
      return <EmptyState icon={History} title={t("users.detail.not_found_title")} description={t("users.detail.not_found_description")} action={<BackLink />} />;
    }
    return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <UserDetail user={query.data} />;
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Button asChild variant="ghost" className="min-h-11 sm:min-h-0">
      <Link to="/users">
        <ArrowLeft aria-hidden="true" />
        {t("users.detail.back")}
      </Link>
    </Button>
  );
}

function UserDetail({ user }: { user: User }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const visible = TABS.filter((tab) => (tab === "activity" ? can("activity_logs.read") : tab === "logins" ? can("login_history.read") : true));
  const tab: Tab = visible.find((value) => value === params.get("tab")) ?? "profile";

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title={fullName(user)}
        description={user.email}
        actions={
          <div className="flex items-center gap-2">
            <UserStatusBadge status={user.status} />
            <UserActions user={user} afterDelete="/users" />
          </div>
        }
      />
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {visible.map((value) => (
            <TabsTrigger key={value} value={value} className="min-h-11 sm:min-h-0">
              {/* users.tabs.profile | roles | activity | logins */}
              {t(`users.tabs.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profile" className="pt-4">
          <ProfileTab user={user} />
        </TabsContent>
        <TabsContent value="roles" className="pt-4">
          {/* Keyed by the saved roles: a save or a refetch resets the local selection. */}
          <RolesTab key={user.roles.map((role) => role.id).join(",")} user={user} />
        </TabsContent>
        {can("activity_logs.read") && (
          <TabsContent value="activity" className="pt-4">
            <ActivityTab userId={user.id} />
          </TabsContent>
        )}
        {can("login_history.read") && (
          <TabsContent value="logins" className="pt-4">
            <LoginsTab userId={user.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ProfileTab({ user }: { user: User }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const update = useUpdateUser();
  const editable = can("users.update");
  const form = useForm<ProfileValues & { role_ids?: string[] }>({
    resolver: zodResolver(profileSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    values: { email: user.email, first_name: user.first_name, last_name: user.last_name },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync([user.id, { email: values.email, first_name: values.first_name, last_name: values.last_name }]);
      toast.success(t("users.detail.saved"));
    } catch (error) {
      if (!applyFieldErrors(error, form.setError, ["email", "first_name", "last_name"])) {
        toast.error(problemMessage(t, error, { 409: "users.errors.email_taken", 403: "users.errors.action_forbidden" }));
      }
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("users.detail.profile_title")}</CardTitle>
        <CardDescription>
          {t("users.detail.meta", { created: formatDateTime(user.created_at), last: formatDateTime(user.last_login_at) || t("users.never") })}
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent>
          <FieldGroup className="max-w-xl">
            <UserProfileFields form={form} disabled={!editable} />
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

function RolesTab({ user }: { user: User }) {
  const { t } = useTranslation();
  const { can, me } = useSession();
  const setRoles = useSetUserRoles();
  const current = user.roles.map((role) => role.id);
  const [selected, setSelected] = useState(current);
  const editable = can("users.assign_roles") && me?.id !== user.id;
  const dirty = [...selected].sort().join(",") !== [...current].sort().join(",");

  // Awaited rather than mutate callbacks: saving remounts this tab (keyed by the saved roles).
  const save = async () => {
    try {
      await setRoles.mutateAsync([user.id, selected]);
      toast.success(t("users.detail.roles_saved"));
    } catch (error) {
      toast.error(problemMessage(t, error, { 403: "users.errors.role_forbidden", 409: "users.errors.last_super_admin" }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("users.detail.roles_title")}</CardTitle>
        <CardDescription>{editable ? t("users.detail.roles_help") : me?.id === user.id ? t("users.detail.roles_self") : t("users.detail.roles_readonly")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RoleChecklist idPrefix="user-role" value={selected} onChange={setSelected} disabled={!editable || setRoles.isPending} />
      </CardContent>
      {editable && (
        <CardFooter className="pt-4">
          <Button className="min-h-11 sm:min-h-0" onClick={save} disabled={!dirty || setRoles.isPending}>
            {t("users.detail.save_roles")}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

const TAB_PAGE_SIZE = 10;

function ActivityTab({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useActivityLogs({ entity_id: userId, page, page_size: TAB_PAGE_SIZE });
  if (query.isPending) return <RowsSkeleton rows={3} />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.items.length === 0) {
    return <EmptyState icon={ScrollText} title={t("users.detail.activity_empty_title")} description={t("users.detail.activity_empty_description")} />;
  }
  return (
    <Card>
      <CardContent>
        <ul className="divide-y">
          {query.data.items.map((log) => (
            <li key={log.id} className="py-3 first:pt-0">
              <ActivityLine log={log} />
            </li>
          ))}
        </ul>
        <ListPagination page={page} pageSize={TAB_PAGE_SIZE} total={query.data.total} onPage={setPage} />
      </CardContent>
    </Card>
  );
}

function LoginsTab({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useLoginHistory({ user_id: userId, page, page_size: TAB_PAGE_SIZE });
  if (query.isPending) return <RowsSkeleton rows={3} />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.items.length === 0) {
    return <EmptyState icon={History} title={t("users.detail.logins_empty_title")} description={t("users.detail.logins_empty_description")} />;
  }
  return (
    <Card>
      <CardContent>
        <ul className="divide-y">
          {query.data.items.map((attempt) => (
            <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="text-sm">
                  <time dateTime={attempt.created_at}>{formatDateTime(attempt.created_at)}</time>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{attempt.ip_address ?? t("logins.unknown_ip")}</span>
                </p>
              </div>
              <LoginOutcomeBadge outcome={attempt.outcome} />
            </li>
          ))}
        </ul>
        <ListPagination page={page} pageSize={TAB_PAGE_SIZE} total={query.data.total} onPage={setPage} />
      </CardContent>
    </Card>
  );
}
