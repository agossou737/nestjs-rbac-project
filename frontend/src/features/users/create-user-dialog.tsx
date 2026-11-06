import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { applyFieldErrors, problemMessage } from "@/api/problem";
import { useCreateUser } from "@/api/queries";
import { FormErrorSummary } from "@/components/data/form-error-summary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { RoleChecklist } from "./role-checklist";
import { profileSchema, UserProfileFields } from "./user-profile-fields";

const schema = profileSchema.extend({ role_ids: z.array(z.string()).optional() });
type Values = z.infer<typeof schema>;
const EMPTY: Values = { email: "", first_name: "", last_name: "", department_id: "", role_ids: [] };

export function CreateUserDialog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateUser();
  const form = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur", reValidateMode: "onChange", defaultValues: EMPTY });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const user = await create.mutateAsync([{ ...values, department_id: values.department_id || undefined }]);
      toast.success(t("users.create.done", { email: user.email }));
      setOpen(false);
      form.reset(EMPTY);
      navigate(`/users/${user.id}`);
    } catch (error) {
      if (!applyFieldErrors(error, form.setError, ["email", "first_name", "last_name", "role_ids"])) {
        setServerError(problemMessage(t, error, { 409: "users.errors.email_taken", 403: "users.errors.role_forbidden" }));
      }
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset(EMPTY);
          setServerError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="min-h-11 sm:min-h-0">
          <Plus aria-hidden="true" />
          {t("users.create.action")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("users.create.title")}</DialogTitle>
          <DialogDescription>{t("users.create.description")}</DialogDescription>
        </DialogHeader>
        <form id="create-user" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormErrorSummary
              errors={form.formState.errors}
              submitCount={form.formState.submitCount}
              labels={{ first_name: t("users.fields.first_name"), last_name: t("users.fields.last_name"), email: t("users.fields.email") }}
            />
            {serverError && (
              <Alert variant="destructive" role="alert">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <UserProfileFields form={form} />
            <FieldSet>
              <FieldLegend variant="label">{t("users.fields.roles_optional")}</FieldLegend>
              <FieldDescription>{t("users.create.roles_help")}</FieldDescription>
              <Controller
                control={form.control}
                name="role_ids"
                render={({ field }) => <RoleChecklist idPrefix="create-role" value={field.value ?? []} onChange={field.onChange} />}
              />
            </FieldSet>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form="create-user" className="min-h-11 sm:min-h-0" disabled={create.isPending}>
            {t("users.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
