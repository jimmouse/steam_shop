import { ArrowRight, BadgeCheck, Coins, PackageOpen, Zap } from "lucide-react";
import Link from "next/link";
import { ProductCover } from "@/components/ProductCover";
import { Price } from "@/components/Price";
import { EmptyState } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { getI18n } from "@/i18n/server";
import { listProducts, localizeProduct } from "@/server/services/products";

export const dynamic = "force-dynamic";

const TYPE_ORDER = ["ACCOUNT", "TOPUP", "REGION_CHANGE"] as const;

export default async function HomePage() {
  const { t, te, locale } = await getI18n("home");
  const tp = await getTranslations("product");
  const products = (await listProducts()).map((p) => localizeProduct(p, locale));
  const groups = new Map<string, typeof products>();
  for (const p of products) groups.set(p.type, [...(groups.get(p.type) ?? []), p]);

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-2xl border bg-card/60 px-6 py-10 md:px-10 md:py-14">
        <div className="pointer-events-none absolute -top-24 -end-24 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("heroTitle")}</h1>
          <p className="mt-3 text-muted-foreground">{t("heroSubtitle")}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5 py-1 ps-2 pe-2.5">
              <Zap className="size-3.5 text-warning" />
              {t("chipAuto")}
            </Badge>
            <Badge variant="outline" className="gap-1.5 py-1 ps-2 pe-2.5">
              <Coins className="size-3.5 text-success" />
              {t("chipPay")}
            </Badge>
            <Badge variant="outline" className="gap-1.5 py-1 ps-2 pe-2.5">
              <BadgeCheck className="size-3.5 text-primary" />
              {t("chipSupport")}
            </Badge>
          </div>
        </div>
      </section>

      {products.length === 0 && <EmptyState icon={<PackageOpen />} title={t("emptyTitle")} description={t("emptyDesc")} />}

      {TYPE_ORDER.filter((type) => groups.has(type)).map((type) => (
        <section key={type}>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight">{te(type)}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t(`sectionDesc.${type}`)}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.get(type)!.map((p) => {
              const out = p.stock !== null && p.stock <= 0;
              return (
                <Link key={p.id} href={`/products/${p.slug}`} className="group focus-visible:outline-none">
                  <Card className="h-full overflow-hidden py-0 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-lg group-hover:shadow-black/20 group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
                    <ProductCover imageUrl={p.imageUrl} region={p.region} type={p.type} name={p.name} className="transition-transform duration-300 group-hover:scale-[1.02]" />
                    <CardContent className="flex flex-1 flex-col pb-5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="font-medium leading-snug">{p.name}</h3>
                        {p.stock !== null ? (
                          <span className={`flex shrink-0 items-center gap-1.5 text-xs ${out ? "text-destructive" : "text-success"}`}>
                            <span className={`size-1.5 rounded-full ${out ? "bg-destructive" : "bg-success"}`} />
                            {out ? t("outOfStock") : t("stock", { n: p.stock })}
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                            {t("manual")}
                          </span>
                        )}
                      </div>
                      {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                      <div className="mt-auto flex items-end justify-between pt-4">
                        <Price usd={p.minPrice} size="lg" className="text-primary" prefix={p.hasVariants ? tp("from") : undefined} showUsd={false} />
                        <span className="flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                          {t("view")}
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
