import { useTranslation } from "react-i18next";
import type { LoginAttempt } from "@/api/mappers";
import { Badge } from "@/components/ui/badge";

export function LoginOutcomeBadge({ outcome }: { outcome: LoginAttempt["outcome"] }) {
  const { t } = useTranslation();
  // logins.outcome.SUCCESS | INVALID_CREDENTIALS | ACCOUNT_LOCKED | ACCOUNT_INACTIVE
  const label = t(`logins.outcome.${outcome}`);
  return outcome === "SUCCESS" ? (
    <Badge className="bg-success text-success-foreground">{label}</Badge>
  ) : (
    <Badge variant="destructive">{label}</Badge>
  );
}
