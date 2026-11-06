import { useTranslation } from "react-i18next";
import { fullName, type ActivityLog } from "@/api/mappers";
import { formatDateTime } from "@/lib/format";

// Known action codes have a French label; an unknown one is shown as its code rather than hidden.
export function useActionLabel() {
  const { t } = useTranslation();
  // activity.actions.user.created | user.updated | user.status_changed | user.deleted | user.password_reset_requested
  // | user.roles_changed | role.created | role.duplicated | role.updated | role.permissions_changed | role.deleted
  // | department.created | department.updated | department.deleted
  // | auth.logout | auth.session_revoked | auth.login_blocked | auth.account_locked | auth.password_reset
  return (action: string) => t(`activity.actions.${action}`, { defaultValue: action });
}

export function ActivityLine({ log }: { log: ActivityLog }) {
  const { t } = useTranslation();
  const label = useActionLabel();
  return (
    <div className="min-w-0">
      <p className="text-sm">
        <span className="font-medium">{log.actor ? fullName(log.actor) : t("activity.system_actor")}</span> {label(log.action)}
      </p>
      <p className="text-xs text-muted-foreground">
        <time dateTime={log.created_at}>{formatDateTime(log.created_at)}</time>
      </p>
    </div>
  );
}
