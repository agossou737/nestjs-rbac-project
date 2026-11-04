import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitize, fieldAttrs, guard, formatPhone, formatAmount, fileError } from "./inputs.ts";

test("npi keeps digits only, 10 at most, pasted spaces removed", () => {
  assert.equal(sanitize.npi("12 34a56-7890123"), "1234567890");
});
test("ifu keeps 13 digits", () => { assert.equal(sanitize.ifu("3 2024 0000 1234 9"), "3202400001234"); });
test("phone keeps 10 digits and formats in pairs", () => {
  assert.equal(sanitize.phone("+229 01 97 12 34 56"), "2290197123"); // the user types the national number; the country code is a separate select
  assert.equal(sanitize.phone("0197123456"), "0197123456");
  assert.equal(formatPhone("0197123456"), "01 97 12 34 56");
});
test("amount keeps an integer and formats in FCFA", () => {
  assert.equal(sanitize.amount("12 500,00"), "1250000");
  assert.equal(sanitize.amount("12500"), "12500");
  assert.equal(formatAmount("12500"), new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(12500));
});
test("email is trimmed and lowercased", () => { assert.equal(sanitize.email("  Aicha.K@Example.BJ "), "aicha.k@example.bj"); });
test("person name keeps letters, accents, space, apostrophe, hyphen and collapses spaces", () => {
  assert.equal(sanitize.personName("Aïcha  N'Diaye-Kouassi 2"), "Aïcha N'Diaye-Kouassi ");
});
test("rccm is upper-cased and limited to its alphabet", () => { assert.equal(sanitize.rccm("rb/cot/24 a 12345!"), "RB/COT/24 A 12345"); });
test("date parts keep their digit count", () => {
  assert.equal(sanitize.day("311"), "31"); assert.equal(sanitize.month("12x"), "12"); assert.equal(sanitize.year("20266"), "2026");
});
test("field attrs carry the soft keyboard and the pattern, never a maxLength that would cut a paste", () => {
  assert.equal(fieldAttrs.npi.inputMode, "numeric"); assert.equal("maxLength" in fieldAttrs.npi, false); assert.equal(fieldAttrs.npi.pattern, "[0-9]{10}");
  assert.equal(fieldAttrs.email.autoComplete, "email"); assert.equal(fieldAttrs.phone.inputMode, "tel");
});
test("file check refuses the wrong type and size", () => {
  assert.equal(fileError({ type: "application/pdf", size: 1024 }), null);
  assert.equal(fileError({ type: "application/zip", size: 1024 }), "errors.file.type");
  assert.equal(fileError({ type: "image/png", size: 6 * 1024 * 1024 }), "errors.file.size");
});

test("guard blocks a forbidden keystroke before it lands and lets the others through", () => {
  const ev = (data: string | null) => { let prevented = false; return { data, preventDefault: () => { prevented = true; }, get prevented() { return prevented; } }; };
  const a = ev("a"); guard.npi(a); assert.equal(a.prevented, true);
  const seven = ev("7"); guard.npi(seven); assert.equal(seven.prevented, false);
  const del = ev(null); guard.npi(del); assert.equal(del.prevented, false); // deletions carry no data
  const apostrophe = ev("'"); guard.personName(apostrophe); assert.equal(apostrophe.prevented, false);
  const digit = ev("4"); guard.personName(digit); assert.equal(digit.prevented, true);
  const pasted = ev(" 98 76 54 32 10 "); guard.npi(pasted); assert.equal(pasted.prevented, false); // multi-character insertions are sanitised, not blocked
  const emoji = ev("\u{1F600}"); guard.npi(emoji); assert.equal(emoji.prevented, true); // one code point, two UTF-16 units
  const react = { nativeEvent: { data: "!" }, preventDefault() { (this as { p?: boolean }).p = true; } }; guard.rccm(react); assert.equal((react as { p?: boolean }).p, true);
});

