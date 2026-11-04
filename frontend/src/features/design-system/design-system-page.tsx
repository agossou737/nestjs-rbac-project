import { CircleAlert, Plus, Trash2, UserRoundX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fieldAttrs, sanitize } from "@/lib/inputs";

const swatches = [
  { key: "primary", className: "bg-primary" },
  { key: "background", className: "bg-background border" },
  { key: "foreground", className: "bg-foreground" },
  { key: "muted_foreground", className: "bg-muted-foreground" },
  { key: "border", className: "bg-border" },
  { key: "destructive", className: "bg-destructive" },
];

// Reference page of the design system, mounted in development only (see router).
export function DesignSystemPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageHeader title={t("design.title")} description={t("design.description")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("design.colors")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {swatches.map((swatch) => (
            <div key={swatch.key} className="space-y-2">
              <div className={`h-12 rounded-md ${swatch.className}`} />
              {/* design.swatch.primary | background | foreground | muted_foreground | border | destructive */}
              <p className="text-sm font-medium">{t(`design.swatch.${swatch.key}`)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("design.typography")}</CardTitle>
          <CardDescription>{t("design.typography_hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-3xl font-semibold">{t("design.sample_display")}</p>
          <p className="text-2xl font-semibold">{t("design.sample_h1")}</p>
          <p className="text-xl font-medium">{t("design.sample_h2")}</p>
          <p className="max-w-prose text-base">{t("design.sample_body")}</p>
          <p className="text-sm text-muted-foreground">{t("design.sample_small")}</p>
          <div className="flex flex-wrap gap-2">
            <code className="rounded-sm bg-muted px-2 py-1 font-mono text-sm">users.create</code>
            <code className="rounded-sm bg-muted px-2 py-1 font-mono text-sm">roles.update</code>
            <code className="rounded-sm bg-muted px-2 py-1 font-mono text-sm">activity_logs.read</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("design.actions")}</CardTitle>
          <CardDescription>{t("design.actions_hint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button className="min-h-11" onClick={() => toast.success(t("design.toast_saved"))}>
            <Plus aria-hidden="true" />
            {t("design.primary_action")}
          </Button>
          <Button variant="outline" className="min-h-11" onClick={() => toast.error(t("design.toast_error"))}>
            {t("design.secondary_action")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="min-h-11 text-destructive">
                <Trash2 aria-hidden="true" />
                {t("design.destructive_action")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("design.confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("design.confirm_description")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" className="min-h-11" onClick={() => toast.success(t("design.toast_deleted"))}>
                  {t("design.destructive_action")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("design.statuses")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge className="bg-success text-success-foreground">{t("design.status_active")}</Badge>
          <Badge variant="secondary">{t("design.status_inactive")}</Badge>
          <Badge variant="destructive">{t("design.status_locked")}</Badge>
          <Badge variant="outline">{t("design.system_role")}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("design.form")}</CardTitle>
        </CardHeader>
        <CardContent className="max-w-md space-y-4">
          <Field>
            <FieldLabel htmlFor="ds-email">{t("design.email_label")}</FieldLabel>
            <FieldDescription id="ds-email-help">{t("design.email_help")}</FieldDescription>
            <Input
              id="ds-email"
              {...fieldAttrs.email}
              aria-describedby="ds-email-help"
              className="min-h-11"
              onChange={(e) => {
                e.target.value = sanitize.email(e.target.value);
              }}
            />
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="ds-check" className="size-11 sm:size-4" />
            <FieldLabel htmlFor="ds-check">{t("design.checkbox_label")}</FieldLabel>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("design.states")}</CardTitle>
          <CardDescription>{t("design.states_hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("design.col_name")}</TableHead>
                  <TableHead>{t("design.col_email")}</TableHead>
                  <TableHead>{t("design.col_status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[0, 1, 2].map((row) => (
                  <TableRow key={row}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserRoundX aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("design.empty_title")}</EmptyTitle>
              <EmptyDescription>{t("design.empty_description")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" className="min-h-11">{t("design.empty_action")}</Button>
            </EmptyContent>
          </Empty>

          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>{t("design.error_title")}</AlertTitle>
            <AlertDescription>
              <p>{t("design.error_description")}</p>
              <Button variant="outline" size="sm" className="mt-2 min-h-11">{t("common.retry")}</Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
