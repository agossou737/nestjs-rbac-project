import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

type ListPaginationProps = { page: number; pageSize: number; total: number; onPage: (page: number) => void };

export function ListPagination({ page, pageSize, total, onPage }: ListPaginationProps) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 pt-4" aria-label={t("common.pagination")}>
      <p className="text-sm text-muted-foreground" role="status">
        {t("common.range", { from: formatNumber(from), to: formatNumber(to), total: formatNumber(total) })}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="min-h-11 sm:min-h-0" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft aria-hidden="true" />
          {t("common.previous")}
        </Button>
        <span className="text-sm tabular-nums">{t("common.page_of", { page, pages })}</span>
        <Button variant="outline" className="min-h-11 sm:min-h-0" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t("common.next")}
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
