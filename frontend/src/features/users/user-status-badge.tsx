import { useTranslation } from "react-i18next";
import type { UserStatus } from "@/api/endpoints";
import { Badge } from "@/components/ui/badge";

const STYLE: Record<UserStatus, { variant: "secondary" | "destructive" | "default"; className?: string }> = {
  ACTIVE: { variant: "default", className: "bg-success text-success-foreground" },
  INACTIVE: { variant: "secondary" },
  LOCKED: { variant: "destructive" },
};

// Status is always written out: colour is never the only signal.
export function UserStatusBadge({ status }: { status: UserStatus }) {
  const { t } = useTranslation();
  // users.status.ACTIVE | INACTIVE | LOCKED
  return (
    <Badge variant={STYLE[status].variant} className={STYLE[status].className}>
      {t(`users.status.${status}`)}
    </Badge>
  );
}
