import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "./config";

/** 服务端页面一次拿齐：通用 t、枚举 te、日期格式化、当前 locale */
export async function getI18n(namespace?: string) {
  const [t, te, f, locale] = await Promise.all([
    namespace ? getTranslations(namespace) : getTranslations(),
    getTranslations("enum"),
    getFormatter(),
    getLocale(),
  ]);
  return {
    t,
    te,
    locale: locale as Locale,
    date: (d: Date | string) => f.dateTime(new Date(d), "full"),
    dateShort: (d: Date | string) => f.dateTime(new Date(d), "short"),
  };
}
