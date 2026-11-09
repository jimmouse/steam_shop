import { ArrowLeft, Check, Mail, MessageCircle, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ApiForm } from "@/components/ApiForm";
import { MessageThread } from "@/components/MessageThread";
import { CodeBlock, MoneyText, Pill, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getI18n } from "@/i18n/server";
import { AppError } from "@/server/lib/utils";
import { formatCustomerInput } from "@/server/services/orders";
import { getTicketForAdmin } from "@/server/services/tickets";

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"] as const;

export default async function AdminTicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ t, te, date }, common, tk, ticket] = await Promise.all([
    getI18n("admin.tickets"),
    getTranslations("common"),
    getTranslations("tickets"),
    getTicketForAdmin(id).catch((e) => {
      if (e instanceof AppError && e.status === 404) return null;
      throw e;
    }),
  ]);
  if (!ticket) notFound();

  const email = ticket.user.identities.find((i) => i.provider === "EMAIL")?.providerUid;
  const tg = ticket.user.identities.find((i) => i.provider === "TELEGRAM");
  const customerInput = ticket.order ? formatCustomerInput(ticket.order.customerInput) : "";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" className="-ms-2 text-muted-foreground" render={<Link href="/admin/tickets" />}>
        <ArrowLeft className="rtl:rotate-180" />
        {t("back")}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Pill>{te(ticket.type)}</Pill>
              </div>
              <CardTitle className="text-lg leading-snug">{ticket.subject}</CardTitle>
              <CardDescription className="mt-1.5 space-y-1 text-xs">
                <p className="font-mono" dir="ltr">
                  {ticket.ticketNo} · {t("createdAt", { date: date(ticket.createdAt) })}
                </p>
                <p className="flex flex-wrap gap-x-3" dir="ltr">
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
                  {!email && !tg && (
                    <span>
                      {common("user")} {ticket.user.id}
                    </span>
                  )}
                </p>
              </CardDescription>
            </div>
            <StatusBadge value={ticket.status} />
          </div>
        </CardHeader>

        {ticket.order && (
          <CardContent>
            <div className="space-y-3 rounded-lg border bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{ticket.order.product.name}</span>
                  <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {ticket.order.orderNo}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MoneyText amount={ticket.order.amount} currency={ticket.order.currency} size="sm" />
                  <StatusBadge value={ticket.order.status} />
                </div>
              </div>
              {customerInput && <CodeBlock dir="ltr">{customerInput}</CodeBlock>}
              {["PAID", "PROCESSING"].includes(ticket.order.status) && (
                <ApiForm action={`/api/admin/orders/${ticket.order.id}/complete`} className="flex flex-col gap-2 sm:flex-row sm:items-end" confirmText={t("completeConfirm")}>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="deliveryPayload" className="text-xs">
                      {t("completeLabel")} <span className="font-normal text-muted-foreground">({common("optional")}, {common("emailAndNotify")})</span>
                    </Label>
                    <Input id="deliveryPayload" name="deliveryPayload" />
                  </div>
                  <Button type="submit" className="shrink-0">
                    <Check />
                    {t("completeBtn")}
                  </Button>
                </ApiForm>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <MessageThread messages={ticket.messages} perspective="staff" />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("replyTitle")}</CardTitle>
          <CardDescription>{t("replyDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiForm action={`/api/admin/tickets/${ticket.id}/reply`} resetOnSuccess successMessage={tk("sent")} className="space-y-3">
            <Textarea name="body" rows={4} maxLength={5000} placeholder={tk("replyPlaceholder")} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <select
                name="status"
                defaultValue=""
                className="h-8 rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">{t("autoStatus")}</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t("setTo", { status: te(s) })}
                  </option>
                ))}
              </select>
              <Button type="submit">
                <SendHorizontal className="rtl:rotate-180" />
                {common("send")}
              </Button>
            </div>
          </ApiForm>
        </CardContent>
      </Card>
    </div>
  );
}
