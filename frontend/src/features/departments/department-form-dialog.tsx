import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { fullName, type Department } from "@/api/mappers";
import { applyFieldErrors, problemMessage, toProblem } from "@/api/problem";
import { useCreateDepartment, useUpdateDepartment } from "@/api/queries";
import { FormErrorSummary } from "@/components/data/form-error-summary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserPicker } from "./user-picker";

// Same rules as the API DTO (departments/dto.ts): the server stays the authority, the form only answers faster.
const schema = z.object({
  code: z.string().regex(/^[A-Z0-9_-]{2,20}$/, { message: "departments.errors.code_format" }),
  name: z.string().trim().min(2, { message: "departments.errors.name_min" }).max(100, { message: "errors.too_long" }),
  description: z.string().trim().max(500, { message: "errors.too_long" }),
  manager: z.object({ id: z.string(), label: z.string() }).nullable(),
});
type Values = z.infer<typeof schema>;

const toValues = (department?: Department): Values => ({
  code: department?.code ?? "",
  name: department?.name ?? "",
  description: department?.description ?? "",
  manager: department?.manager ? { id: department.manager.id, label: fullName(department.manager) } : null,
});

// One dialog for both creation and edition: the department decides which.
export function DepartmentFormDialog({ department, trigger }: { department?: Department; trigger: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const form = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur", reValidateMode: "onChange", defaultValues: toValues(department) });
  const { errors, submitCount } = form.formState;
  const editing = department !== undefined;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const body = { code: values.code, name: values.name, description: values.description || undefined };
    try {
      const saved = editing
        ? await update.mutateAsync([department.id, { ...body, manager_id: values.manager?.id ?? null }])
        : await create.mutateAsync([{ ...body, manager_id: values.manager?.id }]);
      toast.success(t(editing ? "departments.form.updated" : "departments.form.created", { code: saved.code }));
      setOpen(false);
    } catch (error) {
      if (applyFieldErrors(error, form.setError, ["code", "name", "description"])) return;
      if (toProblem(error).status === 409) form.setError("code", { type: "server", message: "departments.errors.taken" });
      else setServerError(problemMessage(t, error, { 404: "departments.errors.manager_gone" }));
    }
  });

  const codeField = form.register("code");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(toValues(department));
        setServerError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(editing ? "departments.form.edit_title" : "departments.form.create_title")}</DialogTitle>
          <DialogDescription>{t("departments.form.description")}</DialogDescription>
        </DialogHeader>
        <form id="department-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormErrorSummary
              errors={errors}
              submitCount={submitCount}
              labels={{ code: t("departments.fields.code"), name: t("departments.fields.name"), description: t("departments.fields.description") }}
            />
            {serverError && (
              <Alert variant="destructive" role="alert">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={!!errors.code}>
              <FieldLabel htmlFor="code">{t("departments.fields.code")}</FieldLabel>
              <FieldDescription id="code-help">{t("departments.form.code_help")}</FieldDescription>
              <Input
                id="code"
                required
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                {...codeField}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
                  void codeField.onChange(e);
                }}
                className="min-h-11 font-mono"
                aria-invalid={!!errors.code}
                aria-describedby={errors.code ? "code-help code-error" : "code-help"}
              />
              {errors.code?.message && <FieldError id="code-error">{t(errors.code.message)}</FieldError>}
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">{t("departments.fields.name")}</FieldLabel>
              <Input
                id="name"
                required
                autoComplete="off"
                {...form.register("name")}
                className="min-h-11"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name?.message && <FieldError id="name-error">{t(errors.name.message)}</FieldError>}
            </Field>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="description">{t("departments.fields.description")}</FieldLabel>
              <Textarea
                id="description"
                {...form.register("description")}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "description-error" : undefined}
              />
              {errors.description?.message && <FieldError id="description-error">{t(errors.description.message)}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="manager">{t("departments.fields.manager")}</FieldLabel>
              <FieldDescription id="manager-help">{t("departments.form.manager_help")}</FieldDescription>
              <Controller
                control={form.control}
                name="manager"
                render={({ field }) => <UserPicker id="manager" value={field.value} onChange={field.onChange} describedBy="manager-help" />}
              />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form="department-form" className="min-h-11 sm:min-h-0" disabled={create.isPending || update.isPending}>
            {t(editing ? "common.save" : "departments.form.create_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
