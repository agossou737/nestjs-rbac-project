import { Copy, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { Role } from "@/api/mappers";
import { problemMessage } from "@/api/problem";
import { useDeleteRole, useDuplicateRole } from "@/api/queries";
import { useSession } from "@/app/session";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function RoleActions({ role, afterDelete }: { role: Role; afterDelete?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const duplicate = useDuplicateRole();
  const remove = useDeleteRole();

  const canDuplicate = can("roles.create");
  // System roles and roles still assigned cannot be deleted (API answers 409): the entry is disabled with its reason.
  const deleteBlocked = role.is_system ? "roles.actions.delete_system" : role.users_count > 0 ? "roles.actions.delete_assigned" : null;
  const canDelete = can("roles.delete");
  if (!canDuplicate && !canDelete) return null;

  // Awaited rather than mutate callbacks: the row unmounts when the list refetches.
  const onDuplicate = async () => {
    try {
      const copy = await duplicate.mutateAsync([role.id]);
      toast.success(t("roles.actions.duplicated", { name: copy.name }));
      navigate(`/roles/${copy.id}`);
    } catch (error) {
      toast.error(problemMessage(t, error, { 403: "roles.errors.grant_forbidden" }));
    }
  };

  const onDelete = async () => {
    try {
      await remove.mutateAsync([role.id]);
      toast.success(t("roles.actions.deleted", { name: role.name }));
      if (afterDelete) navigate(afterDelete);
    } catch (error) {
      toast.error(problemMessage(t, error, { 409: "roles.errors.delete_conflict" }));
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0" aria-label={t("roles.actions.menu", { name: role.name })}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {canDuplicate && (
            <DropdownMenuItem onSelect={onDuplicate} disabled={duplicate.isPending}>
              <Copy aria-hidden="true" />
              {t("roles.actions.duplicate")}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={!!deleteBlocked} onSelect={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden="true" />
                <span className="flex flex-col">
                  {t("roles.actions.delete")}
                  {/* roles.actions.delete_system | delete_assigned */}
                  {deleteBlocked && <span className="text-xs text-muted-foreground">{t(deleteBlocked)}</span>}
                </span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("roles.confirm.delete_title", { name: role.name })}
        description={t("roles.confirm.delete_description")}
        confirmLabel={t("roles.confirm.delete_action")}
        destructive
        pending={remove.isPending}
        onConfirm={onDelete}
      />
    </>
  );
}
