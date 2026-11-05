import { useTranslation } from "react-i18next";
import { useRoles } from "@/api/queries";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

type RoleChecklistProps = { value: string[]; onChange: (roleIds: string[]) => void; idPrefix: string; disabled?: boolean };

// The API refuses a role the actor could not hold; the list shows every role and lets the API decide.
export function RoleChecklist({ value, onChange, idPrefix, disabled }: RoleChecklistProps) {
  const { t } = useTranslation();
  const roles = useRoles({ page: 1, page_size: 100, sort: "name", order: "asc" });

  if (roles.isPending) return <Skeleton className="h-32 w-full" />;
  if (roles.isError) return <p className="text-sm text-destructive">{t("errors.load_failed")}</p>;

  const toggle = (id: string, checked: boolean) => onChange(checked ? [...value, id] : value.filter((roleId) => roleId !== id));
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {roles.data.items.map((role) => (
        <Field key={role.id} orientation="horizontal" className="rounded-md border p-2">
          <Checkbox
            id={`${idPrefix}-${role.id}`}
            className="size-11 sm:size-4"
            checked={value.includes(role.id)}
            disabled={disabled}
            onCheckedChange={(checked) => toggle(role.id, checked === true)}
          />
          <FieldLabel htmlFor={`${idPrefix}-${role.id}`} className="font-normal">
            {role.name}
          </FieldLabel>
        </Field>
      ))}
    </div>
  );
}
