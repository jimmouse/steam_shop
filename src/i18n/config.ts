export const LOCALES = ["zh", "en", "ru", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_COOKIE = "locale";

export const LOCALE_META: Record<Locale, { name: string; dir: "ltr" | "rtl"; intl: string }> = {
  zh: { name: "中文", dir: "ltr", intl: "zh-CN" },
  en: { name: "English", dir: "ltr", intl: "en-US" },
  ru: { name: "Русский", dir: "ltr", intl: "ru-RU" },
  ar: { name: "العربية", dir: "rtl", intl: "ar" },
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** 从 Accept-Language 里挑一个支持的语言 */
export function pickFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}
