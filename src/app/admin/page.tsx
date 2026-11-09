import { ArrowUpRight, Boxes, Clock, CreditCard, Hourglass, Ticket } from "lucide-react";
import Link from "next/link";
import { PageHeader, StatusBadge, fmtMoney } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/server/lib/prisma";
import { expireStaleOrders } from "@/server/services/orders";

export default async function AdminHome() {
  await expireStaleOrders();
  const [{ t, date }, pendingOrders, processingOrders, submittedPayments, openTickets, availableStock, recent] = await Promise.all([
    getI18n("admin.overview"),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }),
    prisma.payment.count({ where: { status: "PENDING", provider: "BEPUSDT" } }),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.inventoryItem.count({ where: { status: "AVAILABLE" } }),
    prisma.order.findMany({
      where: { status: { in: ["PAID", "PROCESSING", "DELIVERED"] } },
      include: { product: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
      take: 8,
    }),
  ]);

  const cards = [
    { title: t("pendingOrders"), n: pendingOrders, href: "/admin/orders?status=PENDING", icon: Clock, tone: "text-warning" },
    { title: t("processingOrders"), n: processingOrders, href: "/admin/orders?status=PROCESSING", icon: Hourglass, tone: "text-info", urgent: processingOrders > 0 },
    { title: t("submittedPayments"), n: submittedPayments, href: "/admin/payments", icon: CreditCard, tone: "text-warning", urgent: false },
    { title: t("openTickets"), n: openTickets, href: "/admin/tickets", icon: Ticket, tone: "text-purple", urgent: openTickets > 0 },
    { title: t("stock"), n: availableStock, href: "/admin/inventory", icon: Boxes, tone: availableStock < 5 ? "text-destructive" : "text-success" },
  ];

  return (
    <div>
      <PageHeader title={t("title")} description={date(new Date())} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.title} href={c.href} className="group focus-visible:outline-none">
            <Card className={`h-full transition-colors group-hover:border-primary/50 ${c.urgent ? "border-primary/30" : ""}`}>
              <CardContent className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{c.title}</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{c.n}</p>
                </div>
                <span className={`flex size-9 items-center justify-center rounded-lg bg-muted ${c.tone}`}>
                  <c.icon className="size-4" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("recent")}</CardTitle>
            <Link href="/admin/orders" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {t("allOrders")}
              <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("recentEmpty")}</p>
          ) : (
            <ul className="divide-y">
              {recent.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate">{o.product.name}</p>
                    <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                      {o.orderNo} · {o.paidAt ? date(o.paidAt) : "-"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm" dir="ltr">
                      {fmtMoney(o.amount, o.currency)}
                    </span>
                    <StatusBadge value={o.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
