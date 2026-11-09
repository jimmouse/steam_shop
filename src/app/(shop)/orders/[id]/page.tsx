import { ArrowLeft, CheckCircle2, Clock, LifeBuoy, PackageCheck, Receipt, ShieldAlert, Ticket as TicketIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApiForm } from "@/components/ApiForm";
import { CopyButton } from "@/components/CopyButton";
import { CountdownText } from "@/components/CountdownText";
import { PayPanel } from "@/components/PayPanel";
import { CodeBlock, Pill, StatusBadge, fmtMoney } from "@/components/shared";
import { Price } from "@/components/Price";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/lib/session";
import { AppError } from "@/server/lib/utils";
import { formatCustomerInput, getOrderForUser } from "@/server/services/orders";
import { gatewayAvailableTypes, type GatewayMeta } from "@/server/services/payments";
import { localizeProduct, localizeVariantName } from "@/server/services/products";

export const dynamic = "force-dynamic";

function stepIndex(status: string): number {
  if (status === "PENDING") return 0;
  if (status === "PAID" || status === "PROCESSING") return 1;
  if (status === "DELIVERED") return 2;
  return -1;
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/orders/${id}`);

  const [{ t, te, date, locale }, order] = await Promise.all([
    getI18n("orders"),
    getOrderForUser(user.id, id).catch((e) => {
      if (e instanceof AppError && e.status === 404) return null;
      throw e;
    }),
  ]);
  if (!order) notFound();

  const productName = localizeProduct({ ...order.product, description: null, faq: null }, locale).name;
  const customerInput = formatCustomerInput(order.customerInput);
  const current = stepIndex(order.status);
  const terminalBad = ["EXPIRED", "CANCELLED", "REFUNDED"].includes(order.status);
  const steps = [t("steps.pending"), order.status === "PROCESSING" ? t("steps.processing") : t("steps.paid"), t("steps.delivered")];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" className="-ms-2 text-muted-foreground" render={<Link href="/orders" />}>
        <ArrowLeft className="rtl:rotate-180" />
        {t("back")}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Pill>{te(order.product.type)}</Pill>
                <Pill>{order.product.region}</Pill>
                {order.variantName && <Pill className="text-foreground">{order.variant ? localizeVariantName(order.variant, locale) : order.variantName}</Pill>}
                <Pill>x{order.quantity}</Pill>
              </div>
              <CardTitle className="text-lg leading-snug">{productName}</CardTitle>
              <CardDescription className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs">
                <span className="flex items-center gap-1" dir="ltr">
                  {order.orderNo}
                  <CopyButton value={order.orderNo} label={t("copyOrderNo")} size="icon-xs" className="text-muted-foreground" />
                </span>
                <span className="text-border">|</span>
                <span className="font-sans">{date(order.createdAt)}</span>
              </CardDescription>
            </div>
            <div className="shrink-0 text-end">
              <Price usd={order.amount.toString()} size="lg" />
              <div className="mt-1.5 flex justify-end">
                <StatusBadge value={order.status} />
              </div>
            </div>
          </div>
        </CardHeader>

        {!terminalBad && (
          <CardContent>
            <ol className="flex items-center gap-2 text-xs">
              {steps.map((text, i) => {
                const done = i < current;
                const active = i === current;
                return (
                  <li key={i} className="flex flex-1 items-center gap-2">
                    <span
                      className={[
                        "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                        done && "border-success bg-success text-background",
                        active && "border-primary text-primary",
                        !done && !active && "border-border text-muted-foreground",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
                    </span>
                    <span className={active ? "font-medium" : done ? "text-muted-foreground" : "text-muted-foreground/60"}>{text}</span>
                    {i < steps.length - 1 && <span className={["h-px flex-1", done ? "bg-success/60" : "bg-border"].join(" ")} />}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        )}

        {customerInput && (
          <CardContent>
            <p className="mb-1.5 text-xs text-muted-foreground">{t("submittedInfo")}</p>
            <CodeBlock>{customerInput}</CodeBlock>
          </CardContent>
        )}
      </Card>

      {order.status === "PENDING" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="size-4 text-primary" />
                  {t("payTitle")}
                </CardTitle>
                <CardDescription className="mt-1">{t("payDesc")}</CardDescription>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-sm">
                <Clock className="size-3.5 text-muted-foreground" />
                <CountdownText until={order.expiresAt.toISOString()} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PayPanel
              orderId={order.id}
              amount={order.amount.toString()}
              currency={order.currency}
              payments={order.payments.map((p) => ({
                id: p.id,
                provider: p.provider,
                status: p.status,
                amount: p.amount.toString(),
                txHash: p.txHash,
                meta: (p.meta as GatewayMeta | null) ?? null,
              }))}
              gatewayTypes={gatewayAvailableTypes()}
              mockEnabled={process.env.NODE_ENV !== "production"}
            />
          </CardContent>
          <Separator />
          <CardContent className="pt-0">
            <ApiForm action={`/api/orders/${order.id}/cancel`} confirmText={t("cancelConfirm")}>
              <Button variant="ghost" size="sm" className="-ms-2 text-muted-foreground hover:text-destructive">
                {t("cancel")}
              </Button>
            </ApiForm>
          </CardContent>
        </Card>
      )}

      {order.deliveryPayload && (
        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-success">
                <PackageCheck className="size-4" />
                {t("deliveryTitle")}
              </CardTitle>
              <CopyButton value={order.deliveryPayload} label={t("copyAll")} size="sm" variant="outline" />
            </div>
            <CardDescription>{order.deliveredAt && t("deliveredAt", { date: date(order.deliveredAt) })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CodeBlock className="bg-background/60 text-[13px]" dir="ltr">
              {order.deliveryPayload}
            </CodeBlock>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
              {t("security")}
            </p>
          </CardContent>
        </Card>
      )}

      {order.status === "PROCESSING" && order.tickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TicketIcon className="size-4 text-primary" />
              {t("progressTitle")}
            </CardTitle>
            <CardDescription>{t("progressDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {order.tickets.map((tk) => (
              <Button key={tk.id} variant="outline" size="sm" render={<Link href={`/tickets/${tk.id}`} />}>
                <span className="font-mono">{tk.ticketNo}</span>
                <StatusBadge value={tk.status} className="ms-1" />
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {order.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("paymentsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {order.payments.map((p) => {
                const meta = p.meta as GatewayMeta | null;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p>
                        {meta?.label ?? te(p.provider)}
                        <span className="ms-2 text-muted-foreground" dir="ltr">
                          {fmtMoney(p.amount, p.currency)}
                        </span>
                      </p>
                      {p.txHash && (
                        <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                          {p.txHash}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <span className="hidden sm:inline">{date(p.createdAt)}</span>
                      <StatusBadge value={p.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {["DELIVERED", "PROCESSING", "PAID"].includes(order.status) && (
        <div className="flex justify-center">
          <Button variant="link" size="sm" className="text-muted-foreground" render={<Link href={`/tickets/new?orderId=${order.id}`} />}>
            <LifeBuoy />
            {t("supportLink")}
          </Button>
        </div>
      )}
    </div>
  );
}
