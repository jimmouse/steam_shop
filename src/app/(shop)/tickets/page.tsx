import { ChevronRight, Plus, Ticket } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader, Pill, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/lib/session";
import { listTicketsForUser } from "@/server/services/tickets";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/tickets");
  const [{ t, te, date }, tickets] = await Promise.all([getI18n("tickets"), listTicketsForUser(user.id)]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t("title")}
        description={t("desc")}
        action={
          <Button render={<Link href="/tickets/new" />}>
            <Plus />
            {t("new")}
          </Button>
        }
      />
      {tickets.length === 0 ? (
        <EmptyState icon={<Ticket />} title={t("emptyTitle")} description={t("emptyDesc")} />
      ) : (
        <Card className="divide-y py-0">
          {tickets.map((tk) => (
            <Link
              key={tk.id}
              href={`/tickets/${tk.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{tk.subject}</p>
                  <Pill>{te(tk.type)}</Pill>
                </div>
                <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span className="font-mono" dir="ltr">
                    {tk.ticketNo}
                  </span>
                  {tk.order && (
                    <>
                      <span>·</span>
                      <span className="font-mono" dir="ltr">
                        {tk.order.orderNo}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span>{t("updatedAt", { date: date(tk.updatedAt) })}</span>
                </p>
              </div>
              <StatusBadge value={tk.status} />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
