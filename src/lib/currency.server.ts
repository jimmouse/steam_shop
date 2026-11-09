import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { CURRENCY_COOKIE, DEFAULT_CURRENCY, LOCALE_DEFAULT_CURRENCY, getRates, isCurrency, type Currency } from "./currency";

/** 当前展示货币：cookie → 语言默认 → USD */
export async function resolveCurrency(): Promise<Currency> {
  const store = await cookies();
  const c = store.get(CURRENCY_COOKIE)?.value;
  if (isCurrency(c)) return c;
  const locale = await getLocale();
  return LOCALE_DEFAULT_CURRENCY[locale] ?? DEFAULT_CURRENCY;
}

export async function getCurrencyContext() {
  const [currency, rates] = await Promise.all([resolveCurrency(), getRates()]);
  return { currency, rates };
}
