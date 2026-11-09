import { Layers, Package, Plus } from "lucide-react";
import { AddVariantForm, CreateProductForm, ToggleProductActiveForm } from "@/components/forms/ProductForms";
import { VariantRow } from "@/components/forms/VariantRow";
import { EmptyState, MoneyText, PageHeader, Pill } from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";
import { listProducts } from "@/server/services/products";

export default async function AdminProductsPage() {
  const [{ t, te }, products] = await Promise.all([getI18n("admin.products"), listProducts({ includeInactive: true })]);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title={t("title")} description={t("count", { n: products.length })} />
        {products.length === 0 ? (
          <EmptyState icon={<Package />} title={t("empty")} description={t("emptyDesc")} />
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <Card key={p.id} className={p.active ? "" : "opacity-60"}>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{p.name}</p>
                        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                          /{p.slug}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Pill>{te(p.type)}</Pill>
                        <Pill>{p.region}</Pill>
                        <Pill>{te(p.deliveryMode)}</Pill>
                        {p.stock !== null && <Pill className={p.stock > 0 ? "text-success" : "text-destructive"}>{t("stock", { n: p.stock })}</Pill>}
                      </div>
                    </div>
                    {!p.hasVariants && <MoneyText amount={p.price} currency={p.currency} />}
                    <ToggleProductActiveForm id={p.id} active={p.active} />
                  </div>

                  <div className="rounded-lg border bg-black/20 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Layers className="size-3.5" />
                      {t("variants")}
                      {!p.hasVariants && <span className="font-normal">· {t("noVariants")}</span>}
                    </p>
                    {p.hasVariants && (
                      <ul className="mb-3 divide-y">
                        {p.variants.map((v) => (
                          <VariantRow key={v.id} v={{ ...v, i18n: (v.i18n as Record<string, string> | null) ?? null }} />
                        ))}
                      </ul>
                    )}
                    <AddVariantForm productId={p.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" />
            {t("createTitle")}
          </CardTitle>
          <CardDescription>{t("createDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateProductForm />
        </CardContent>
      </Card>
    </div>
  );
}
