import { OrderStatus } from "@prisma/client";
import { Check, Mail, MessageCircle, ReceiptText, Undo2 } from "lucide-react";
import Link from "next/link";
import { ApiForm } from "@/components/ApiForm";
import { FilterChips } from "@/components/FilterChips";
import { CodeBlock, EmptyState, MoneyText, PageHeader, Pill, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getI18n } from "@/i18n/server";
import { formatCustomerInput, listAllOrders } from "@/server/services/orders";
import { localizeVariantName } from "@/server/services/products";

const STATUSES = Object.values(OrderStatus);

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const valid = STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
  const [{ t, te, date, locale }, orders] = await Promise.all([getI18n("admin.orders"), listAllOrders({ status: valid })]);

  return (
    <div>
      <PageHeader title={t("title")} description={t("count", { n: orders.length })} />
      <FilterChips basePath="/admin/orders" current={valid} options={STATUSES.map((s) => ({ value: s, label: te(s) }))} />

      {orders.length === 0 ? (
        <EmptyState icon={<ReceiptText />} title={t("empty")} />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const email = o.user.identities.find((i) => i.provider === "EMAIL")?.providerUid;
            const tg = o.user.identities.find((i) => i.provider === "TELEGRAM");
            const input = formatCustomerInput(o.customerInput);
            const actionable = o.status === "PAID" || o.status === "PROCESSING";
            return (
              <Card key={o.id}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{o.product.name}</p>
                        <Pill>{o.product.region}</Pill>
                        {o.variantName && <Pill className="text-foreground">{o.variant ? localizeVariantName(o.variant, locale) : o.variantName}</Pill>}
                        <Pill>x{o.quantity}</Pill>
                        <Pill>{te(o.source)}</Pill>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">
                        {o.orderNo} · {date(o.createdAt)}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground" dir="ltr">
                        {email && (
                          <span className="flex items-center gap-1">
                            <Mail className="size-3" />
                            {email}
                          </span>
                        )}
                        {tg && (
                          <span className="flex items-center gap-1">
                            <MessageCircle className="size-3" />
                            {tg.displayName ?? tg.providerUid}
                          </span>
                        )}
                        {!email && !tg && <span>{o.userId}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <MoneyText amount={o.amount} currency={o.currency} />
                      <StatusBadge value={o.status} />
                    </div>
                  </div>

                  {input && <CodeBlock dir="ltr">{input}</CodeBlock>}

                  {o.tickets.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {t("ticketsLabel")}
                      {o.tickets.map((tk) => (
                        <Link key={tk.id} href={`/admin/tickets/${tk.id}`} className="font-mono text-primary hover:underline">
                          {tk.ticketNo}
                        </Link>
                      ))}
                    </div>
                  )}

                  {o.deliveryPayload && (
                    <CodeBlock className="text-success" dir="ltr">
                      {o.deliveryPayload}
                    </CodeBlock>
                  )}

                  {actionable && (
                    <>
                      <Separator />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <ApiForm action={`/api/admin/orders/${o.id}/complete`} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end" confirmText={t("completeConfirm")}>
                          <div className="flex-1 space-y-1.5">
                            <Label htmlFor={`dp-${o.id}`} className="text-xs">
                              {t("completeLabel")}
                            </Label>
                            <Input id={`dp-${o.id}`} name="deliveryPayload" />
                          </div>
                          <Button type="submit" className="shrink-0">
                            <Check />
                            {t("completeBtn")}
                          </Button>
                        </ApiForm>
                        <ApiForm action={`/api/admin/orders/${o.id}/refund`} confirmText={t("refundConfirm")}>
                          <Button type="submit" variant="destructive">
                            <Undo2 />
                            {t("refundBtn")}
                          </Button>
                        </ApiForm>
                      </div>
                    </>
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
