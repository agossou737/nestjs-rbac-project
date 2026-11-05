import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { authApi } from "@/api/endpoints";
import { applyFieldErrors, problemMessage } from "@/api/problem";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z
  .object({
    // Same bounds as the API (PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH).
    password: z.string().min(12, { message: "errors.password.min" }).max(128, { message: "errors.password.max" }),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, { path: ["confirm"], message: "errors.password.mismatch" });
type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur", reValidateMode: "onChange", defaultValues: { password: "", confirm: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) return;
    setServerError(null);
    try {
      await authApi.resetPassword({ token, password: values.password });
      toast.success(t("auth.reset.done"));
      navigate("/login", { replace: true });
    } catch (error) {
      if (!applyFieldErrors(error, form.setError, ["password"])) {
        setServerError(problemMessage(t, error, { 400: "auth.reset.invalid_link", 429: "auth.login.throttled" }));
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold outline-none" tabIndex={-1}>{t("auth.reset.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.reset.subtitle")}</p>
      </div>
      {!token ? (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{t("auth.reset.missing_title")}</AlertTitle>
          <AlertDescription>{t("auth.reset.invalid_link")}</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {serverError && (
              <Alert variant="destructive" role="alert">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="password">{t("auth.reset.password")}</FieldLabel>
              <FieldDescription id="password-help">{t("auth.reset.password_help")}</FieldDescription>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                {...form.register("password")}
                className="min-h-11"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-help password-error" : "password-help"}
              />
              {errors.password?.message && <FieldError id="password-error">{t(errors.password.message)}</FieldError>}
            </Field>
            <Field data-invalid={!!errors.confirm}>
              <FieldLabel htmlFor="confirm">{t("auth.reset.confirm")}</FieldLabel>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                {...form.register("confirm")}
                className="min-h-11"
                aria-invalid={!!errors.confirm}
                aria-describedby={errors.confirm ? "confirm-error" : undefined}
              />
              {errors.confirm?.message && <FieldError id="confirm-error">{t(errors.confirm.message)}</FieldError>}
            </Field>
            <Button type="submit" className="min-h-11 w-full" disabled={isSubmitting}>
              {t("auth.reset.submit")}
            </Button>
          </FieldGroup>
        </form>
      )}
      <Link to={token ? "/login" : "/forgot-password"} className="inline-flex min-h-11 items-center sm:min-h-0 text-sm text-primary underline-offset-4 hover:underline">
        {token ? t("auth.back_to_login") : t("auth.reset.request_new")}
      </Link>
    </div>
  );
}
