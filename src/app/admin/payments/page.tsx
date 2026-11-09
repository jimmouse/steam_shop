import { Check, CreditCard, ExternalLink, X } from "lucide-react";
import { ApiForm } from "@/components/ApiForm";
import { EmptyState, MoneyText, PageHeader, Pill, StatusBadge } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getI18n } from "@/i18n/server";
import { listPaymentsForAdmin, type GatewayMeta } from "@/server/services/payments";

const EXPLORERS: Record<string, (tx: string) => string> = {
  TRC20: (tx) => `https://tronscan.org/#/transaction/${tx}`,
  Tron: (tx) => `https://tronscan.org/#/transaction/${tx}`,
  BEP20: (tx) => `https://bscscan.com/tx/${tx}`,
  BSC: (tx) => `https://bscscan.com/tx/${tx}`,
  Polygon: (tx) => `https://polygonscan.com/tx/${tx}`,
  ERC20: (tx) => `https://etherscan.io/tx/${tx}`,
  Ethereum: (tx) => `https://etherscan.io/tx/${tx}`,
  Arbitrum: (tx) => `https://arbiscan.io/tx/${tx}`,
  Base: (tx) => `https://basescan.org/tx/${tx}`,
  Solana: (tx) => `https://solscan.io/tx/${tx}`,
  TON: (tx) => `https://tonviewer.com/transaction/${tx}`,
};
function explorerUrl(network: string | undefined, tx: string): string {
  return (network && EXPLORERS[network]?.(tx)) || `https://tronscan.org/#/transaction/${tx}`;
}

/** 待付 / 超时的网关支付单：用户转错金额或网络导致没自动匹配时，在链上核实后这里人工确认。 */
export default async function AdminPaymentsPage() {
  const [{ t, te, date }, payments] = await Promise.all([getI18n("admin.payments"), listPaymentsForAdmin()]);

  return (
    <div>
      <PageHeader title={t("title")} description={t("desc")} />
      <Alert className="mb-6">
        <CreditCard />
        <AlertDescription>{t("hint")}</AlertDescription>
      </Alert>

      {payments.length === 0 ? (
        <EmptyState icon={<CreditCard />} title={t("empty")} />
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const meta = p.meta as GatewayMeta | null;
            return (
              <Card key={p.id}>
                <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <MoneyText amount={p.amount} currency={p.currency} />
                      <Pill>{meta?.label ?? te(p.provider)}</Pill>
                      <StatusBadge value={p.status} />
                    </div>
                    <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                      {p.order.orderNo} · {date(p.createdAt)}
                    </p>
                    {meta?.address && (
                      <p className="font-mono text-xs break-all text-muted-foreground" dir="ltr">
                        {meta.uniqueAmount} {meta.payCurrency} → {meta.address}
                      </p>
                    )}
                    {p.txHash && (
                      <a
                        href={explorerUrl(meta?.network, p.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 font-mono text-xs break-all text-primary hover:underline"
                        dir="ltr"
                      >
                        {p.txHash}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    )}
                  </div>
                  {(p.status === "PENDING" || p.status === "EXPIRED") && p.order.status !== "DELIVERED" && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <ApiForm action={`/api/admin/payments/${p.id}/confirm`} confirmText={t("confirmPrompt")} className="flex gap-2">
                        <Input name="txHash" placeholder={t("txPlaceholder")} className="w-48 font-mono text-xs" dir="ltr" />
                        <Button type="submit">
                          <Check />
                          {t("confirm")}
                        </Button>
                      </ApiForm>
                      {p.status === "PENDING" && (
                        <ApiForm action={`/api/admin/payments/${p.id}/reject`} confirmText={t("rejectPrompt")}>
                          <Button type="submit" variant="outline">
                            <X />
                            {t("reject")}
                          </Button>
                        </ApiForm>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
