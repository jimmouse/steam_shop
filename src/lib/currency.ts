/**
 * 展示货币。所有价格与结算都以 USD 存储；这里只负责「按当前展示货币换算显示」。
 * 汇率来源 open.er-api.com（免费、无需 key、每日更新），内存缓存 6 小时，失败回退到静态表。
 */
export const CURRENCIES = ["USD", "CNY", "RUB", "AED", "SAR", "TRY", "EUR", "IDR", "THB", "VND", "PHP", "MYR"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "USD";
export const CURRENCY_COOKIE = "currency";

/** 各语言的默认展示货币 */
export const LOCALE_DEFAULT_CURRENCY: Record<string, Currency> = { zh: "CNY", ru: "RUB", ar: "AED", en: "USD" };

export const CURRENCY_META: Record<Currency, { symbol: string; name: string }> = {
  USD: { symbol: "$", name: "US Dollar" },
  CNY: { symbol: "¥", name: "人民币" },
  RUB: { symbol: "₽", name: "Рубль" },
  AED: { symbol: "د.إ", name: "درهم إماراتي" },
  SAR: { symbol: "﷼", name: "ريال سعودي" },
  TRY: { symbol: "₺", name: "Türk Lirası" },
  EUR: { symbol: "€", name: "Euro" },
  IDR: { symbol: "Rp", name: "Rupiah" },
  THB: { symbol: "฿", name: "บาท" },
  VND: { symbol: "₫", name: "Đồng" },
  PHP: { symbol: "₱", name: "Piso" },
  MYR: { symbol: "RM", name: "Ringgit" },
};

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

/** 静态兜底汇率（1 USD = x），API 不可用时使用 */
const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1, CNY: 7.25, RUB: 95, AED: 3.6725, SAR: 3.75, TRY: 34, EUR: 0.92, IDR: 15800, THB: 34.5, VND: 25300, PHP: 57, MYR: 4.4,
};

export type Rates = Record<Currency, number>;

let cache: { rates: Rates; fetchedAt: number } | null = null;
const TTL = 6 * 60 * 60 * 1000;

export async function getRates(): Promise<Rates> {
  if (cache && Date.now() - cache.fetchedAt < TTL) return cache.rates;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 21600 }, signal: AbortSignal.timeout(5000) });
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (json.result === "success" && json.rates) {
      const rates = { ...FALLBACK_RATES };
      for (const c of CURRENCIES) if (typeof json.rates[c] === "number") rates[c] = json.rates[c];
      cache = { rates, fetchedAt: Date.now() };
      return rates;
    }
  } catch {
    // 回退到静态表
  }
  cache = { rates: FALLBACK_RATES, fetchedAt: Date.now() - TTL + 10 * 60 * 1000 }; // 10 分钟后再试
  return FALLBACK_RATES;
}

export function convert(amountUsd: number | string, to: Currency, rates: Rates): number {
  return Number(amountUsd) * (rates[to] ?? 1);
}
