import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_META, isLocale, pickFromAcceptLanguage, type Locale } from "./config";

export async function resolveLocale(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const h = await headers();
  return pickFromAcceptLanguage(h.get("accept-language")) ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Asia/Shanghai",
    formats: {
      dateTime: {
        short: { year: "numeric", month: "2-digit", day: "2-digit" },
        full: { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false },
      },
    },
    // 对外展示用的 Intl locale（zh → zh-CN）
    now: new Date(),
    onError: (err) => {
      if (process.env.NODE_ENV !== "production") console.warn("[i18n]", err.message);
    },
    getMessageFallback: ({ key, namespace }) => (namespace ? `${namespace}.${key}` : key),
  };
});

export { LOCALE_META };
