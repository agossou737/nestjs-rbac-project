import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { problemMessage } from "@/api/problem";
import { useSession } from "@/app/session";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldAttrs, sanitize } from "@/lib/inputs";

const schema = z.object({
  email: z.string().email({ message: "errors.format.email" }),
  password: z.string().min(1, { message: "errors.required" }),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login } = useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur", reValidateMode: "onChange", defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;
  const emailField = form.register("email");

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      const redirect = params.get("redirect");
      // Only same-app paths: an open redirect would send a fresh session to another site.
      navigate(redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/", { replace: true });
    } catch (error) {
      setServerError(problemMessage(t, error, { 401: "auth.login.invalid", 429: "auth.login.throttled" }));
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold outline-none" tabIndex={-1}>{t("auth.login.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.login.subtitle")}</p>
      </div>
      {serverError && (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">{t("auth.fields.email")}</FieldLabel>
            <Input
              id="email"
              required
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
          <Field data-invalid={!!errors.password}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="password">{t("auth.fields.password")}</FieldLabel>
              <Link to="/forgot-password" className="inline-flex min-h-11 items-center sm:min-h-0 text-sm text-primary underline-offset-4 hover:underline">
                {t("auth.login.forgot")}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              {...form.register("password")}
              className="min-h-11"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            {errors.password?.message && <FieldError id="password-error">{t(errors.password.message)}</FieldError>}
          </Field>
          <Button type="submit" className="min-h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
