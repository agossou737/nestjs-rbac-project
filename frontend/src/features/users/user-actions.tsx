import { KeyRound, MoreHorizontal, Trash2, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { fullName, type User } from "@/api/mappers";
import { problemMessage } from "@/api/problem";
import { useDeleteUser, useResetUserPassword, useSetUserStatus } from "@/api/queries";
import { useSession } from "@/app/session";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Pending = "deactivate" | "reset" | "delete" | null;

// Row actions shown only to whom the API would allow them; the API still enforces every rule.
export function UserActions({ user, afterDelete }: { user: User; afterDelete?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, can } = useSession();
  const [pending, setPending] = useState<Pending>(null);
  const setStatus = useSetUserStatus();
  const reset = useResetUserPassword();
  const remove = useDeleteUser();
  const name = fullName(user);
  const self = me?.id === user.id;

  const fail = (error: unknown) => toast.error(problemMessage(t, error, { 403: "users.errors.action_forbidden", 409: "users.errors.last_super_admin" }));

  // mutateAsync, not mutate(..., callbacks): the row may unmount once the list refetches, which would drop the callbacks.
  const run = async (action: () => Promise<unknown>, success: string, after?: () => void) => {
    try {
      await action();
      toast.success(success);
      after?.();
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  };

  const activate = () => run(() => setStatus.mutateAsync([user.id, "ACTIVE"]), t("users.actions.activated", { name }));

  const actions = {
    deactivate: () => run(() => setStatus.mutateAsync([user.id, "INACTIVE"]), t("users.actions.deactivated", { name })),
    reset: () => run(() => reset.mutateAsync([user.id]), t("users.actions.reset_sent", { email: user.email })),
    delete: () =>
      run(() => remove.mutateAsync([user.id]), t("users.actions.deleted", { name }), () => {
        if (afterDelete) navigate(afterDelete);
      }),
  };

  const canStatus = can("users.update") && !self;
  const canReset = can("users.reset_password") && !self;
  const canDelete = can("users.delete") && !self;
  if (!canStatus && !canReset && !canDelete) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0" aria-label={t("users.actions.menu", { name })}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canStatus &&
            (user.status === "ACTIVE" ? (
              <DropdownMenuItem onSelect={() => setPending("deactivate")}>
                <UserX aria-hidden="true" />
                {t("users.actions.deactivate")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={activate}>
                <UserCheck aria-hidden="true" />
                {t("users.actions.activate")}
              </DropdownMenuItem>
            ))}
          {canReset && (
            <DropdownMenuItem onSelect={() => setPending("reset")}>
              <KeyRound aria-hidden="true" />
              {t("users.actions.reset")}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setPending("delete")}>
                <Trash2 aria-hidden="true" />
                {t("users.actions.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          // users.confirm.deactivate_* | reset_* | delete_*
          title={t(`users.confirm.${pending}_title`, { name })}
          description={t(`users.confirm.${pending}_description`, { name, email: user.email })}
          confirmLabel={t(`users.confirm.${pending}_action`)}
          destructive={pending !== "reset"}
          pending={setStatus.isPending || reset.isPending || remove.isPending}
          onConfirm={actions[pending]}
        />
      )}
    </>
  );
}
