#!/usr/bin/env node
// Fails if a key used in src/ is missing from fr, or a fr key is missing from en.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const root = "src";
const locales = join(root, "locales");
const flatten = (obj, prefix = "") => Object.entries(obj).flatMap(([k, v]) =>
  typeof v === "object" && v !== null ? flatten(v, prefix + k + ".") : [prefix + k]);
const loadLang = (lang) => new Set(readdirSync(join(locales, lang)).filter(f => f.endsWith(".json"))
  .flatMap(f => flatten(JSON.parse(readFileSync(join(locales, lang, f), "utf8")), f.replace(".json", "") + ".")));
const walk = (dir) => readdirSync(dir).flatMap(n => { const p = join(dir, n);
  return statSync(p).isDirectory() ? (p.startsWith(locales) ? [] : walk(p)) : /\.(ts|tsx|vue|js|jsx|mts|mjs)$/.test(n) ? [p] : []; });
// t("key"), { message: "key" } in zod schemas, i18nKey="key" (Trans), keypath="key" (i18n-t)
const KEY = /(?:\bt\(\s*|\bmessage\s*:\s*|\bi18nKey\s*=\s*|\bkeypath\s*=\s*)["'`]([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+)["'`]/g;
const used = new Set();
for (const file of walk(root)) for (const m of readFileSync(file, "utf8").matchAll(KEY)) used.add(m[1]);
const has = (set, k) => set.has(k) || set.has(k + "_one") || set.has(k + "_other");
const fr = loadLang("fr"), en = loadLang("en");
const missingFr = [...used].filter(k => !has(fr, k));
const missingEn = [...fr].filter(k => !en.has(k));
if (missingFr.length) console.error("missing in fr:", missingFr.join(", "));
if (missingEn.length) console.error("missing in en:", missingEn.join(", "));
if (missingFr.length || missingEn.length) process.exit(1);
console.log(`i18n ok: ${used.size} keys used, fr ${fr.size}, en ${en.size}`);
