import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DateRangeFilterProps = {
  idPrefix: string;
  from: string | undefined;
  to: string | undefined;
  onChange: (changes: { from?: string; to?: string }) => void;
};

export function DateRangeFilter({ idPrefix, from, to, onChange }: DateRangeFilterProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="w-full space-y-1 sm:w-40">
        <Label htmlFor={`${idPrefix}-from`}>{t("common.date_from")}</Label>
        <Input id={`${idPrefix}-from`} type="date" value={from ?? ""} max={to} onChange={(e) => onChange({ from: e.target.value || undefined })} className="min-h-11 sm:min-h-0" />
      </div>
      <div className="w-full space-y-1 sm:w-40">
        <Label htmlFor={`${idPrefix}-to`}>{t("common.date_to")}</Label>
        <Input id={`${idPrefix}-to`} type="date" value={to ?? ""} min={from} onChange={(e) => onChange({ to: e.target.value || undefined })} className="min-h-11 sm:min-h-0" />
      </div>
    </>
  );
}
