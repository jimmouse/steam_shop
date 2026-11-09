"use client";

import { AlertTriangle, ArrowLeftRight, Coins, ExternalLink, FlaskConical, Loader2, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ApiForm } from "./ApiForm";
import { CopyButton } from "./CopyButton";
import { Pill } from "./shared";

/** 与 server/services/payments.ts 的 GatewayMeta 对齐 */
export interface GatewayMetaLike {
  payType: string;
  label: string;
  payCurrency: string;
  network: string;
  payUrl: string;
  qrcode: string | null;
  address: string;
  payAmount: string;
  uniqueAmount: string;
  rate: string | null;
  expiredAt: string | null;
}

interface PaymentLike {
  id: string;
  provider: "MOCK" | "BEPUSDT";
  status: string;
  amount: string;
  txHash: string | null;
  meta: GatewayMetaLike | null;
}

export interface GatewayTypeLike {
  type: string;
  label: string;
  currency: string;
  network: string;
}

interface Props {
  orderId: string;
  amount: string;
  currency: string;
  payments: PaymentLike[];
  gatewayTypes: GatewayTypeLike[];
  mockEnabled: boolean;
}

const CURRENCY_TONE: Record<string, string> = {
  USDT: "text-success",
  USDC: "text-[#2775ca]",
  TRX: "text-[#ff060a]",
  ETH: "text-[#8c8cf0]",
  BNB: "text-[#f0b90b]",
  TON: "text-[#0098ea]",
};

function CurrencyBadge({ currency, className }: { currency: string; className?: string }) {
  return (
    <span
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-[11px] font-semibold tracking-tight", CURRENCY_TONE[currency] ?? "text-foreground", className)}
      dir="ltr"
    >
      {currency}
    </span>
  );
}

export function PayPanel({ orderId, amount, currency, payments, gatewayTypes, mockEnabled }: Props) {
  const t = useTranslations("payment");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = payments.find((p) => p.status === "PENDING");

  useEffect(() => {
    if (!active || active.provider !== "BEPUSDT") return;
    const i = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(i);
  }, [active, router]);

  async function start(body: { provider: PaymentLike["provider"]; payType?: string }) {
    setBusy(body.payType ?? body.provider);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(null);
      setError(json?.error?.message ?? t("startFailed"));
      return;
    }
    // 模拟支付：创建后立刻触发「支付商回调」，一步到位
    if (body.provider === "MOCK" && json?.data?.payment?.id) {
      const sim = await fetch("/api/payments/mock/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: json.data.payment.id, status: "success" }),
      });
      if (!sim.ok) {
        const j = await sim.json().catch(() => ({}));
        setError(j?.error?.message ?? t("callbackFailed"));
      }
    }
    setBusy(null);
    router.refresh();
  }

  // ── 1. 选择链 / 币种 ──
  if (!active) {
    return (
      <div className="space-y-4">
        {gatewayTypes.length > 0 && <p className="text-xs text-muted-foreground">{t("method.chooseNetwork")}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {gatewayTypes.map((m) => {
            const loading = busy === m.type;
            return (
              <button
                key={m.type}
                type="button"
                disabled={!!busy}
                onClick={() => start({ provider: "BEPUSDT", payType: m.type })}
                className={cn(
                  "group flex items-center gap-4 rounded-xl border bg-card p-4 text-start transition-all",
                  "hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  "disabled:opacity-60",
                )}
              >
                {loading ? (
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Loader2 className="size-5 animate-spin" />
                  </span>
                ) : (
                  <CurrencyBadge currency={m.currency} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    {m.currency}
                    <Pill>{m.network}</Pill>
                  </span>
                  <span className="block text-xs text-muted-foreground">{t("method.onchainDesc", { network: m.network })}</span>
                </span>
                <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{t("method.select")}</span>
              </button>
            );
          })}
        </div>
        {gatewayTypes.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            <Coins className="size-4 shrink-0" />
            {t("method.none")}
          </div>
        )}
        {mockEnabled && (
          <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => start({ provider: "MOCK" })} className="text-muted-foreground">
            {busy === "MOCK" ? <Loader2 className="animate-spin" /> : <FlaskConical />}
            {t("mockBtn")}
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  // ── 2. 网关待支付（链上转账） ──
  if (active.provider === "BEPUSDT" && active.meta) {
    const m = active.meta;
    const others = gatewayTypes.filter((x) => x.type !== m.payType);
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm">
          <CurrencyBadge currency={m.payCurrency} className="size-7 text-[10px]" />
          <span className="font-medium">{m.payCurrency}</span>
          <Pill>{m.network}</Pill>
          <span className="ms-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {t("waiting")}
          </span>
        </div>

        <div className="flex flex-col items-center gap-5 rounded-xl border bg-black/20 p-5 sm:flex-row sm:items-stretch">
          {m.qrcode ? (
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="rounded-xl bg-white p-2 shadow-lg shadow-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.qrcode} alt="QR" className="size-44 rounded-md" />
              </div>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <QrCode className="size-3" />
                {t("scanHint")}
              </span>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{t("payExact")}</p>
              <p className="mt-0.5 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-destructive" dir="ltr">
                  {m.uniqueAmount}
                </span>
                <span className="text-sm font-medium text-muted-foreground">{m.payCurrency}</span>
                <CopyButton value={m.uniqueAmount} label={t("copyAmount")} size="icon-xs" className="text-muted-foreground" />
              </p>
              {m.rate && Number(m.rate) > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("rateLine", { amount, currency, rate: m.rate, payCurrency: m.payCurrency })}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground">{t("address")}</p>
              <div className="mt-1 flex items-center gap-1 rounded-lg border bg-background/60 ps-3 pe-1" dir="ltr">
                <code className="min-w-0 flex-1 truncate py-2 font-mono text-xs text-primary">{m.address}</code>
                <CopyButton value={m.address} label={t("copyAddress")} />
              </div>
            </div>

            <Alert className="border-warning/30 bg-warning/10 py-2.5 text-warning [&>svg]:text-warning">
              <AlertTriangle />
              <AlertTitle className="text-xs font-medium">{t("exactTitle")}</AlertTitle>
              <AlertDescription className="text-xs text-warning/80">{t("exactDesc", { network: m.network })}</AlertDescription>
            </Alert>

            {m.payUrl && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" render={<a href={m.payUrl} target="_blank" rel="noreferrer" />}>
                  <ExternalLink />
                  {t("openCashier")}
                </Button>
                <CopyButton value={m.payUrl} label={t("copyLink")} size="sm" variant="outline" />
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("afterPay")} {t("notConfirmed")}
        </p>

        {others.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {others.map((x) => (
                <Button key={x.type} variant="ghost" size="sm" disabled={!!busy} onClick={() => start({ provider: "BEPUSDT", payType: x.type })} className="text-muted-foreground">
                  {busy === x.type ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />}
                  {t("switchTo", { label: x.label })}
                </Button>
              ))}
            </div>
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  // ── 3. 模拟支付（仅当上一步创建成功但回调未触发时才会看到） ──
  if (active.provider === "MOCK") {
    return (
      <Alert className="border-warning/30 bg-warning/10 [&>svg]:text-warning">
        <FlaskConical />
        <AlertTitle>{t("mockPendingTitle")}</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>{t("mockPendingDesc")}</p>
          <ApiForm action="/api/payments/mock/simulate" transform={() => ({ paymentId: active.id, status: "success" })}>
            <Button size="sm">{t("mockPendingBtn")}</Button>
          </ApiForm>
        </AlertDescription>
      </Alert>
    );
  }

  // 兜底：有未知类型的待支付记录时不渲染任何操作
  return null;
}
