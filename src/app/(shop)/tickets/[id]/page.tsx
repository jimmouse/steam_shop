import { ArrowLeft, Lock, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApiForm } from "@/components/ApiForm";
import { MessageThread } from "@/components/MessageThread";
import { Pill, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/lib/session";
import { AppError } from "@/server/lib/utils";
import { getTicketForUser } from "@/server/services/tickets";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/tickets/${id}`);

  const [{ t, te }, ticket] = await Promise.all([
    getI18n("tickets"),
    getTicketForUser(user.id, id).catch((e) => {
      if (e instanceof AppError && e.status === 404) return null;
      throw e;
    }),
  ]);
  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" className="-ms-2 text-muted-foreground" render={<Link href="/tickets" />}>
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
              <CardDescription className="mt-1.5 flex flex-wrap items-center gap-x-2 font-mono text-xs" dir="ltr">
                {ticket.ticketNo}
                {ticket.order && (
                  <>
                    <span className="text-border">|</span>
                    <Link href={`/orders/${ticket.order.id}`} className="text-primary hover:underline">
                      {ticket.order.orderNo}
                    </Link>
                  </>
                )}
              </CardDescription>
            </div>
            <StatusBadge value={ticket.status} />
          </div>
        </CardHeader>
      </Card>

      <MessageThread messages={ticket.messages} perspective="user" />

      {ticket.status !== "CLOSED" ? (
        <Card>
          <CardContent>
            <ApiForm action={`/api/tickets/${ticket.id}/messages`} resetOnSuccess successMessage={t("sent")} className="space-y-3">
              <Textarea name="body" required rows={4} maxLength={5000} placeholder={t("replyPlaceholder")} />
              <div className="flex justify-end">
                <Button type="submit">
                  <SendHorizontal className="rtl:rotate-180" />
                  {t("send")}
                </Button>
              </div>
            </ApiForm>
          </CardContent>
        </Card>
      ) : (
        <p className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          {t("closed")}
        </p>
      )}
    </div>
  );
}
