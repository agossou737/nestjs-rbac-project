import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { TableHead } from "@/components/ui/table";

type SortableHeadProps = {
  field: string;
  sort: string | undefined;
  order: "asc" | "desc" | undefined;
  onSort: (field: string) => void;
  children: ReactNode;
  className?: string;
};

export function SortableHead({ field, sort, order, onSort, children, className }: SortableHeadProps) {
  const active = sort === field;
  const Icon = !active ? ArrowUpDown : order === "desc" ? ArrowDown : ArrowUp;
  return (
    <TableHead className={className} aria-sort={active ? (order === "desc" ? "descending" : "ascending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 font-medium hover:text-foreground" onClick={() => onSort(field)}>
        {children}
        <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </button>
    </TableHead>
  );
}
