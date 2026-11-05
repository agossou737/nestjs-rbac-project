import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";

// Sign-in screens: the product name on a primary block is the one coloured element (ui.md, ECR-001 to 003).
export function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary-foreground/15">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold">{t("common.app_name")}</span>
        </div>
        <div className="max-w-md space-y-3">
          <p className="text-3xl font-semibold">{t("auth.aside_title")}</p>
          <p className="text-primary-foreground">{t("auth.aside_body")}</p>
        </div>
        <p className="text-sm text-primary-foreground">{t("auth.aside_footer")}</p>
      </aside>
      <main className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <KeyRound className="size-4" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold">{t("common.app_name")}</span>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
