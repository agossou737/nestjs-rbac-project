import { CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import type { FieldErrors } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type FormErrorSummaryProps = { errors: FieldErrors; labels: Record<string, string>; submitCount: number };

// Forms of more than three fields list their errors on top, with a link to each field; focus moves here on a failed submit.
export function FormErrorSummary({ errors, labels, submitCount }: FormErrorSummaryProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const fields = Object.keys(labels).filter((field) => errors[field]);

  const hasErrors = fields.length > 0;
  // Only a new submission moves the focus, not each keystroke.
  useEffect(() => {
    if (submitCount > 0 && hasErrors) ref.current?.focus();
  }, [submitCount, hasErrors]);

  if (fields.length === 0) return null;
  return (
    <Alert variant="destructive" role="alert" ref={ref} tabIndex={-1}>
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{t("errors.summary_title")}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {fields.map((field) => (
            <li key={field}>
              <a href={`#${field}`} className="underline underline-offset-4">
                {labels[field]}
              </a>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
