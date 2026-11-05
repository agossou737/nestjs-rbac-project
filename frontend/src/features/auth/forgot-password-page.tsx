import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { z } from "zod";
import { authApi } from "@/api/endpoints";
import { problemMessage } from "@/api/problem";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldAttrs, sanitize } from "@/lib/inputs";

const schema = z.object({ email: z.string().email({ message: "errors.format.email" }) });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur", reValidateMode: "onChange", defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;
  const emailField = form.register("email");

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await authApi.forgotPassword(values);
      setSent(true);
    } catch (error) {
      setServerError(problemMessage(t, error, { 429: "auth.login.throttled" }));
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold outline-none" tabIndex={-1}>{t("auth.forgot.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.forgot.subtitle")}</p>
      </div>
      {sent ? (
        <Alert role="status">
          <MailCheck aria-hidden="true" />
          <AlertTitle>{t("auth.forgot.sent_title")}</AlertTitle>
          <AlertDescription>{t("auth.forgot.sent_body")}</AlertDescription>
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
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">{t("auth.fields.email")}</FieldLabel>
              <FieldDescription id="email-help">{t("auth.forgot.email_help")}</FieldDescription>
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
                aria-describedby={errors.email ? "email-help email-error" : "email-help"}
              />
              {errors.email?.message && <FieldError id="email-error">{t(errors.email.message)}</FieldError>}
            </Field>
            <Button type="submit" className="min-h-11 w-full" disabled={isSubmitting}>
              {t("auth.forgot.submit")}
            </Button>
          </FieldGroup>
        </form>
      )}
      <Link to="/login" className="inline-flex min-h-11 items-center sm:min-h-0 text-sm text-primary underline-offset-4 hover:underline">
        {t("auth.back_to_login")}
      </Link>
    </div>
  );
}
