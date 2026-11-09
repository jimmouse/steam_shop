import { TicketStatus } from "@prisma/client";
import { ChevronRight, Ticket } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FilterChips } from "@/components/FilterChips";
import { EmptyState, PageHeader, Pill, StatusBadge } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";
import { listTicketsForAdmin } from "@/server/services/tickets";

const STATUSES = Object.values(TicketStatus);

export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const valid = STATUSES.includes(status as TicketStatus) ? (status as TicketStatus) : undefined;
  const [{ t, te, date }, tickets, common] = await Promise.all([getI18n("admin.tickets"), listTicketsForAdmin(valid), getTranslations("common")]);

  return (
    <div>
      <PageHeader title={t("title")} description={t("count", { n: tickets.length })} />
      <FilterChips basePath="/admin/tickets" current={valid} allLabel={t("unclosed")} options={STATUSES.map((s) => ({ value: s, label: te(s) }))} />

      {tickets.length === 0 ? (
        <EmptyState icon={<Ticket />} title={t("empty")} />
      ) : (
        <Card className="divide-y py-0">
          {tickets.map((tk) => {
            const email = tk.user.identities.find((i) => i.provider === "EMAIL")?.providerUid;
            return (
              <Link
                key={tk.id}
                href={`/admin/tickets/${tk.id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
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
                    <span>·</span>
                    <span dir="ltr">{email ?? common("noEmail")}</span>
                    {tk.order && (
                      <>
                        <span>·</span>
                        <span className="font-mono" dir="ltr">
                          {tk.order.orderNo}
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span>{date(tk.updatedAt)}</span>
                  </p>
                </div>
                <StatusBadge value={tk.status} />
                <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
