import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fullName } from "@/api/mappers";
import { useUsers } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PickedUser = { id: string; label: string };

type UserPickerProps = {
  id: string;
  value: PickedUser | null;
  onChange: (user: PickedUser | null) => void;
  disabled?: boolean;
  describedBy?: string;
};

// A combobox (Popover + Command, shadcn's recipe) that searches on the server: the API filters, the list stays short,
// however many accounts exist. Command's own filtering is off because the server already filtered.
export function UserPicker({ id, value, onChange, disabled, describedBy }: UserPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const users = useUsers({ search: debounced || undefined, status: "ACTIVE", page: 1, page_size: 10, sort: "last_name", order: "asc" });

  const pick = (user: PickedUser | null) => {
    onChange(user);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-describedby={describedBy}
          disabled={disabled}
          className="min-h-11 w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value?.label ?? t("departments.form.manager_none")}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={t("departments.form.manager_search")} />
          <CommandList>
            <CommandEmpty>{users.isPending ? t("departments.form.manager_loading") : t("departments.form.manager_no_result")}</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem value="__none__" onSelect={() => pick(null)}>
                  {t("departments.form.manager_clear")}
                </CommandItem>
              )}
              {users.data?.items.map((user) => {
                const label = fullName(user);
                return (
                  <CommandItem key={user.id} value={user.id} onSelect={() => pick({ id: user.id, label })}>
                    <Check className={cn(value?.id === user.id ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate">{label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
