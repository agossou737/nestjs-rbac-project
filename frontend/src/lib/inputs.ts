// Shared input helpers of the ASIN ui rules (skills/ui/references/forms-ux.md).
// Spread `fieldAttrs.<type>` on a shadcn Input, block forbidden keystrokes with `guard.<type>` on
// beforeinput, and pass the value through `sanitize.<type>` on every change (covers pasting and the
// length), so the field can only hold what the data type allows.
// No `maxLength` on sanitised types: the browser applies it to a paste before any handler runs, so a
// pasted " 98 76 54 32 10 " would be cut to its first ten characters; `sanitize` bounds the length instead.
// Display formatting (`formatPhone`, `formatAmount`) is applied on blur; the stored value stays raw.

export type FieldAttrs = {
  type?: "text" | "email" | "file";
  inputMode?: "text" | "numeric" | "tel" | "email";
  pattern?: string;
  autoComplete?: string;
  spellCheck?: boolean;
  autoCapitalize?: "off" | "characters" | "words";
  accept?: string;
};

const digits = (value: string, max: number) => value.replace(/\D+/g, "").slice(0, max);

export const sanitize = {
  npi: (v: string) => digits(v, 10),
  ifu: (v: string) => digits(v, 13),
  phone: (v: string) => digits(v, 10),
  day: (v: string) => digits(v, 2),
  month: (v: string) => digits(v, 2),
  year: (v: string) => digits(v, 4),
  amount: (v: string) => digits(v, 15),
  email: (v: string) => v.trim().toLowerCase(),
  personName: (v: string) => v.replace(/[^\p{L}\p{M}' -]/gu, "").replace(/\s{2,}/g, " "),
  rccm: (v: string) => v.toUpperCase().replace(/[^A-Z0-9 /-]/g, "").slice(0, 30),
};

export const fieldAttrs: Record<keyof typeof sanitize | "file", FieldAttrs> = {
  npi: { inputMode: "numeric", pattern: "[0-9]{10}", autoComplete: "off", spellCheck: false },
  ifu: { inputMode: "numeric", pattern: "[0-9]{13}", autoComplete: "off", spellCheck: false },
  phone: { inputMode: "tel", pattern: "[0-9]{10}", autoComplete: "tel-national", spellCheck: false },
  day: { inputMode: "numeric", pattern: "[0-9]{1,2}", autoComplete: "bday-day" },
  month: { inputMode: "numeric", pattern: "[0-9]{1,2}", autoComplete: "bday-month" },
  year: { inputMode: "numeric", pattern: "[0-9]{4}", autoComplete: "bday-year" },
  amount: { inputMode: "numeric", pattern: "[0-9]*", autoComplete: "off", spellCheck: false },
  email: { type: "email", inputMode: "email", autoComplete: "email", spellCheck: false, autoCapitalize: "off" },
  personName: { inputMode: "text", autoComplete: "name", autoCapitalize: "words", spellCheck: false },
  rccm: { inputMode: "text", autoComplete: "off", autoCapitalize: "characters", spellCheck: false },
  file: { type: "file", accept: "application/pdf,image/jpeg,image/png" },
};

// Blocks a single keystroke the type does not allow before it lands, so a rejected key never produces
// a stale re-render (React) or a flicker (Vue). A multi-character insertion (paste, autocomplete, IME
// commit) is let through and cleaned by `sanitize` on change: blocking it whole would reject a pasted
// "12 345 678 90". Deletions carry no `data`.
type BeforeInput = { data?: string | null; nativeEvent?: { data?: string | null }; preventDefault: () => void };
const blockChars = (forbidden: RegExp) => (e: BeforeInput) => {
  const data = e.nativeEvent?.data ?? e.data;
  if (data != null && [...data].length === 1 && forbidden.test(data)) e.preventDefault();
};
export const guard = {
  npi: blockChars(/\D/), ifu: blockChars(/\D/), phone: blockChars(/\D/), day: blockChars(/\D/), month: blockChars(/\D/), year: blockChars(/\D/), amount: blockChars(/\D/),
  personName: blockChars(/[^\p{L}\p{M}' -]/u), rccm: blockChars(/[^A-Za-z0-9 /-]/),
};

export const formatPhone = (v: string) => sanitize.phone(v).replace(/(\d{2})(?=\d)/g, "$1 ").trim();

const xof = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });
export const formatAmount = (v: string) => (v === "" ? "" : xof.format(Number(sanitize.amount(v))));

export const FILE_MAX_BYTES = 5 * 1024 * 1024;
const FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
// Returns an i18n key, or null when the file is acceptable.
export const fileError = (file: { type: string; size: number }) =>
  !FILE_TYPES.has(file.type) ? "errors.file.type" : file.size > FILE_MAX_BYTES ? "errors.file.size" : null;

