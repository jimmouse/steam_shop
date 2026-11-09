import { ChevronRight, ReceiptText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader, Pill, StatusBadge } from "@/components/shared";
import { Price } from "@/components/Price";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/lib/session";
import { listOrdersForUser } from "@/server/services/orders";
import { localizeProduct, localizeVariantName } from "@/server/services/products";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");
  const [{ t, date, locale }, orders] = await Promise.all([getI18n("orders"), listOrdersForUser(user.id)]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("count", { n: orders.length })} />
      {orders.length === 0 ? (
        <EmptyState icon={<ReceiptText />} title={t("emptyTitle")} description={t("emptyDesc")} action={<Button render={<Link href="/" />}>{t("browse")}</Button>} />
      ) : (
        <Card className="divide-y py-0">
          {orders.map((o) => {
            const name = localizeProduct({ ...o.product, description: null, faq: null }, locale).name;
            return (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{name}</p>
                    <Pill>{o.product.region}</Pill>
                    {o.variantName && <Pill className="text-foreground">{o.variant ? localizeVariantName(o.variant, locale) : o.variantName}</Pill>}
                    {o.quantity > 1 && <Pill>x{o.quantity}</Pill>}
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span className="font-mono" dir="ltr">
                      {o.orderNo}
                    </span>
                    <span>·</span>
                    <span>{date(o.createdAt)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Price usd={o.amount.toString()} />
                  <StatusBadge value={o.status} />
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
