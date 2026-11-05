import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { fullName, initials } from "@/api/mappers";
import { useSession } from "@/app/session";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, logout } = useSession();
  if (!me) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The visible name is part of the accessible name (WCAG 2.5.3); on phones it stays for screen readers only. */}
        <Button variant="ghost" className="min-h-11 gap-2 px-2">
          <Avatar className="size-8" aria-hidden="true">
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-medium">{initials(me)}</AvatarFallback>
          </Avatar>
          <span className="sr-only text-sm font-medium sm:not-sr-only sm:max-w-40 sm:truncate">{fullName(me)}</span>
          <span className="sr-only">{t("nav.user_menu")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1">
          <p className="truncate text-sm font-medium">{fullName(me)}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{me.email}</p>
          <p className="text-xs font-normal text-muted-foreground">{me.roles.map((role) => role.name).join(", ") || t("nav.no_role")}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            navigate("/login", { replace: true });
          }}
        >
          <LogOut aria-hidden="true" />
          {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
