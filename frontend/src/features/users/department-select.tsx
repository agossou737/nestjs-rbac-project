import { useTranslation } from "react-i18next";
import { useDepartments } from "@/api/queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Radix Select refuses an empty string as an item value: "none" stands for "no department" inside the widget only.
const NONE = "none";

type DepartmentSelectProps = {
  id: string;
  value: string;
  onChange: (departmentId: string) => void;
  disabled?: boolean;
  noneLabel?: string;
};

// shortcut: lists the first 100 departments; switch to a server-search combobox (see UserPicker) beyond that.
export function DepartmentSelect({ id, value, onChange, disabled, noneLabel }: DepartmentSelectProps) {
  const { t } = useTranslation();
  const departments = useDepartments({ page: 1, page_size: 100, sort: "name", order: "asc" });
  return (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? "" : next)} disabled={disabled}>
      <SelectTrigger id={id} className="min-h-11 w-full sm:min-h-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel ?? t("users.fields.no_department")}</SelectItem>
        {departments.data?.items.map((department) => (
          <SelectItem key={department.id} value={department.id}>
            <span className="font-mono text-xs">{department.code}</span> {department.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
