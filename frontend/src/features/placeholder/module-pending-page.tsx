import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// shortcut: stands in for module screens until phase 7 wires them to the API, delete then.
export function ModulePendingPage({ navKey }: { navKey: string }) {
  const { t } = useTranslation();
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Construction aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t(`nav.items.${navKey}`)}</EmptyTitle>
        <EmptyDescription>{t("common.module_pending")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
