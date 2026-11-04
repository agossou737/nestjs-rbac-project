import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const files = import.meta.glob("./locales/*/*.json", { eager: true });
const resources: Record<string, { translation: Record<string, unknown> }> = {};
for (const [path, mod] of Object.entries(files)) {
  const match = path.match(/locales\/(\w+)\/(\w+)\.json$/);
  if (!match) continue;
  const [, lang, domain] = match;
  (resources[lang] ??= { translation: {} }).translation[domain] = (mod as { default: unknown }).default;
}

void i18n.use(initReactI18next).init({ resources, lng: "fr", fallbackLng: "fr", interpolation: { escapeValue: false } });

export default i18n;
