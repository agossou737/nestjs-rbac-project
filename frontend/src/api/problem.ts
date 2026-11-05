import { isAxiosError } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

export type FieldProblem = { field: string; rule: string; message: string };
export type Problem = { status: number; title: string; detail: string; errors: FieldProblem[] };

// Turns any failure into the RFC 9457 shape the API answers with; a network failure becomes status 0.
export function toProblem(error: unknown): Problem {
  if (isAxiosError(error) && error.response) {
    const body = error.response.data as Partial<Problem> | undefined;
    return {
      status: error.response.status,
      title: body?.title ?? error.response.statusText,
      detail: body?.detail ?? "",
      errors: Array.isArray(body?.errors) ? body.errors : [],
    };
  }
  return { status: 0, title: "Network error", detail: "", errors: [] };
}

type Translate = (key: string) => string;

// One French message per status; a screen passes overrides for statuses that mean something specific there
// (409 on a user form: email already used).
export function problemMessage(t: Translate, error: unknown, overrides: Partial<Record<number, string>> = {}): string {
  const { status } = toProblem(error);
  const key = overrides[status] ?? STATUS_KEYS[status] ?? "errors.http.unknown";
  return t(key);
}

// errors.http.0 | 400 | 401 | 403 | 404 | 409 | 429 | 500 | unknown
const STATUS_KEYS: Record<number, string> = {
  0: "errors.http.0",
  400: "errors.http.400",
  401: "errors.http.401",
  403: "errors.http.403",
  404: "errors.http.404",
  409: "errors.http.409",
  429: "errors.http.429",
  500: "errors.http.500",
};

// Attaches server-side validation errors (errors[].field) to the matching form fields.
export function applyFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly Path<T>[]): boolean {
  const problems = toProblem(error).errors.filter((item) => (fields as readonly string[]).includes(item.field));
  for (const item of problems) setError(item.field as Path<T>, { type: "server", message: "errors.server_field" });
  return problems.length > 0;
}
