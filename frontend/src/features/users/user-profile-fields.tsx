import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldAttrs, guard, sanitize } from "@/lib/inputs";

// Same bounds as the API DTOs (users/dto.ts).
export const profileSchema = z.object({
  email: z.string().email({ message: "errors.format.email" }).max(254, { message: "errors.too_long" }),
  first_name: z.string().trim().min(1, { message: "errors.required" }).max(100, { message: "errors.too_long" }),
  last_name: z.string().trim().min(1, { message: "errors.required" }).max(100, { message: "errors.too_long" }),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export function UserProfileFields({ form, disabled }: { form: UseFormReturn<ProfileValues & { role_ids?: string[] }>; disabled?: boolean }) {
  const { t } = useTranslation();
  const { errors } = form.formState;

  const nameField = (name: "first_name" | "last_name", autoComplete: string) => {
    const registered = form.register(name);
    const error = errors[name]?.message;
    return (
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor={name}>{t(`users.fields.${name}`)}</FieldLabel>
        <Input
          id={name}
          required
          disabled={disabled}
          {...fieldAttrs.personName}
          autoComplete={autoComplete}
          {...registered}
          onBeforeInput={guard.personName}
          onChange={(e) => {
            e.target.value = sanitize.personName(e.target.value);
            void registered.onChange(e);
          }}
          className="min-h-11"
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        {error && <FieldError id={`${name}-error`}>{t(error)}</FieldError>}
      </Field>
    );
  };

  const emailField = form.register("email");
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {nameField("first_name", "given-name")}
        {nameField("last_name", "family-name")}
      </div>
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="email">{t("users.fields.email")}</FieldLabel>
        <Input
          id="email"
          required
          disabled={disabled}
          {...fieldAttrs.email}
          {...emailField}
          onChange={(e) => {
            e.target.value = sanitize.email(e.target.value);
            void emailField.onChange(e);
          }}
          className="min-h-11"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email?.message && <FieldError id="email-error">{t(errors.email.message)}</FieldError>}
      </Field>
    </>
  );
}
