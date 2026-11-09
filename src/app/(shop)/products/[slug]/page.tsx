import { ArrowLeft, Clock, HelpCircle, Zap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductOrderForm } from "@/components/forms/ProductOrderForm";
import { FaqAccordion, pickCommonFaq } from "@/components/FaqAccordion";
import { ProductCover } from "@/components/ProductCover";
import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getTranslations } from "next-intl/server";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/lib/session";
import { getProductBySlug, localizeProduct, localizeVariants, parseInputSchema } from "@/server/services/products";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ t, te, locale }, tf, raw, user] = await Promise.all([getI18n("product"), getTranslations("faq"), getProductBySlug(slug), getCurrentUser()]);
  if (!raw) notFound();
  const product = localizeProduct(raw, locale);

  const fields = parseInputSchema(product.inputSchema);
  const faq = product.faq;
  const commonFaq = pickCommonFaq((k) => tf.raw(k), product.type);
  const outOfStock = product.stock !== null && product.stock <= 0;
  const auto = product.deliveryMode === "AUTO_INVENTORY";

  return (
    <div className="mx-auto max-w-4xl">
      <Button variant="ghost" size="sm" className="-ms-2 mb-4 text-muted-foreground" render={<Link href="/" />}>
        <ArrowLeft className="rtl:rotate-180" />
        {t("back")}
      </Button>

      <div className="grid gap-6 md:grid-cols-5">
        <div className="space-y-6 md:col-span-3">
          <Card className="overflow-hidden pt-0">
            <ProductCover imageUrl={product.imageUrl} region={product.region} type={product.type} name={product.name} size="hero" />
            <CardHeader>
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Pill>{te(product.type)}</Pill>
                <Pill>{product.region}</Pill>
              </div>
              <CardTitle className="text-2xl leading-tight">{product.name}</CardTitle>
              <CardDescription className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {auto ? (
                  <span className="flex items-center gap-1.5">
                    <Zap className="size-3.5 text-warning" />
                    {t("autoDelivery")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-info" />
                    {t("manualDelivery")}
                  </span>
                )}
                {product.stock !== null && (
                  <span className={outOfStock ? "text-destructive" : "text-success"}>{outOfStock ? t("outOfStock") : t("inStock", { n: product.stock })}</span>
                )}
              </CardDescription>
            </CardHeader>
            {product.description && (
              <CardContent>
                <Separator className="mb-4" />
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{product.description}</p>
              </CardContent>
            )}
          </Card>

          {(faq.length > 0 || commonFaq.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="size-4 text-primary" />
                  {t("faqTitle")}
                </CardTitle>
                <CardDescription>
                  {t("faqNoAnswer")}{" "}
                  <Link href="/tickets/new" className="text-primary hover:underline">
                    {t("contactUs")}
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {faq.length > 0 && (
                  <section>
                    <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{tf("productSection")}</h3>
                    <FaqAccordion items={faq} openFirst idPrefix="p" />
                  </section>
                )}
                {commonFaq.length > 0 && (
                  <section>
                    <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{tf("generalSection")}</h3>
                    <FaqAccordion items={commonFaq} openFirst={faq.length === 0} idPrefix="c" />
                    <p className="mt-3 text-xs text-muted-foreground">
                      <Link href="/faq" className="text-primary hover:underline">
                        {tf("pageTitle")} →
                      </Link>
                    </p>
                  </section>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit md:sticky md:top-20 md:col-span-2">
          <CardContent>
            <ProductOrderForm
              slug={slug}
              auto={auto}
              basePrice={product.price}
              stock={product.stock}
              variants={localizeVariants(product.variants, locale)}
              fields={fields}
              expireMinutes={process.env.ORDER_EXPIRE_MINUTES ?? "15"}
              loggedIn={!!user}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
