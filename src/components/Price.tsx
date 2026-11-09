"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useFormatter } from "next-intl";
import { convert, type Currency, type Rates } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface Ctx {
  currency: Currency;
  rates: Rates;
}

const CurrencyContext = createContext<Ctx>({ currency: "USD", rates: { USD: 1 } as Rates });

export function CurrencyProvider({ currency, rates, children }: Ctx & { children: ReactNode }) {
  return <CurrencyContext.Provider value={{ currency, rates }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

/** 零小数货币不显示小数位 */
const ZERO_DECIMAL = new Set(["IDR", "VND"]);

/**
 * 价格展示：USD 金额 → 当前展示货币。非 USD 时附带原始 USD 作为次级信息。
 * 服务端与客户端都可用（它是客户端组件，服务端页面直接渲染即可）。
 */
export function Price({
  usd,
  size = "md",
  className,
  showUsd = true,
  prefix,
}: {
  usd: number | string | { toString(): string };
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showUsd?: boolean;
  /** 例如「起」/ "from" */
  prefix?: string;
}) {
  const { currency, rates } = useCurrency();
  const f = useFormatter();
  const value = Number(usd.toString());
  const converted = convert(value, currency, rates);
  const digits = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const main = f.number(converted, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-xl", xl: "text-3xl" };

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      {prefix && <span className="text-[0.7em] font-normal text-muted-foreground">{prefix}</span>}
      <span className={cn("font-semibold tabular-nums tracking-tight", sizes[size])} dir="ltr">
        {main}
      </span>
      {showUsd && currency !== "USD" && (
        <span className="text-[0.7em] font-normal text-muted-foreground tabular-nums" dir="ltr">
          ≈ {f.number(value, { style: "currency", currency: "USD" })}
        </span>
      )}
    </span>
  );
}
