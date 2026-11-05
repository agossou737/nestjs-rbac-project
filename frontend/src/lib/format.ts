import i18n from "@/i18n";

const locale = () => (i18n.language === "en" ? "en-GB" : "fr-FR");

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function formatDay(isoDay: string): string {
  return new Intl.DateTimeFormat(locale(), { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(isoDay));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(locale()).format(value);
}

// A yyyy-mm-dd picked in a date field covers the whole local day; the API filters on UTC instants.
export function dayStartIso(day: string | undefined): string | undefined {
  return day ? new Date(`${day}T00:00:00`).toISOString() : undefined;
}

export function dayEndIso(day: string | undefined): string | undefined {
  return day ? new Date(`${day}T23:59:59.999`).toISOString() : undefined;
}
