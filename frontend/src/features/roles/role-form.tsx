import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Same bounds as the API DTOs (roles/dto.ts).
export const roleSchema = z.object({
  name: z.string().trim().min(2, { message: "roles.errors.name_min" }).max(50, { message: "errors.too_long" }),
  description: z.string().trim().max(500, { message: "errors.too_long" }),
});
export type RoleValues = z.infer<typeof roleSchema>;

export function RoleFields({ form, nameLocked, disabled }: { form: UseFormReturn<RoleValues>; nameLocked?: boolean; disabled?: boolean }) {
  const { t } = useTranslation();
  const { errors } = form.formState;
  return (
    <>
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="role-name">{t("roles.fields.name")}</FieldLabel>
        {nameLocked && <FieldDescription id="role-name-help">{t("roles.fields.name_locked")}</FieldDescription>}
        <Input
          id="role-name"
          required
          autoComplete="off"
          disabled={disabled || nameLocked}
          {...form.register("name")}
          className="min-h-11"
          aria-invalid={!!errors.name}
          aria-describedby={[nameLocked && "role-name-help", errors.name && "role-name-error"].filter(Boolean).join(" ") || undefined}
        />
        {errors.name?.message && <FieldError id="role-name-error">{t(errors.name.message)}</FieldError>}
      </Field>
      <Field data-invalid={!!errors.description}>
        <FieldLabel htmlFor="role-description">{t("roles.fields.description")}</FieldLabel>
        <Textarea
          id="role-description"
          disabled={disabled}
          {...form.register("description")}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "role-description-error" : undefined}
        />
        {errors.description?.message && <FieldError id="role-description-error">{t(errors.description.message)}</FieldError>}
      </Field>
    </>
  );
}
