import { Boxes, Upload } from "lucide-react";
import { ImportInventoryForm } from "@/components/forms/ImportInventoryForm";
import { EmptyState, PageHeader, Pill } from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTranslations } from "next-intl/server";
import { getI18n } from "@/i18n/server";
import { inventorySummary, listProducts } from "@/server/services/products";

export default async function AdminInventoryPage() {
  const [{ t }, tp, products, summary] = await Promise.all([
    getI18n("admin.inventory"),
    getTranslations("admin.products"),
    listProducts({ includeInactive: true }),
    inventorySummary(),
  ]);
  const autoProducts = products.filter((p) => p.deliveryMode === "AUTO_INVENTORY");
  const zero = { AVAILABLE: 0, LOCKED: 0, SOLD: 0 };

  // 展平成行：无规格商品一行；有规格商品每个规格一行
  type Row = { key: string; product: (typeof autoProducts)[number]; variant: string | null; s: typeof zero };
  const rows: Row[] = autoProducts.flatMap((p): Row[] =>
    p.hasVariants
      ? p.variants.map((v) => ({ key: `${p.id}:${v.id}`, product: p, variant: v.name, s: summary[`${p.id}:${v.id}`] ?? zero }))
      : [{ key: `${p.id}:`, product: p, variant: null, s: summary[`${p.id}:`] ?? zero }],
  );

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title={t("title")} description={t("desc")} />
        {autoProducts.length === 0 ? (
          <EmptyState icon={<Boxes />} title={t("empty")} description={t("emptyDesc")} />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead>{tp("variant")}</TableHead>
                  <TableHead className="text-end">{t("available")}</TableHead>
                  <TableHead className="text-end">{t("locked")}</TableHead>
                  <TableHead className="text-end">{t("sold")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={r.product.active ? "" : "text-muted-foreground line-through"}>{r.product.name}</span>
                        <Pill>{r.product.region}</Pill>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">
                      {r.variant ?? <span className="text-muted-foreground">{tp("noVariant")}</span>}
                    </TableCell>
                    <TableCell className={`text-end font-mono tabular-nums ${r.s.AVAILABLE === 0 ? "text-destructive" : "text-success"}`}>{r.s.AVAILABLE}</TableCell>
                    <TableCell className="text-end font-mono tabular-nums text-warning">{r.s.LOCKED}</TableCell>
                    <TableCell className="text-end font-mono tabular-nums text-muted-foreground">{r.s.SOLD}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {autoProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-4 text-primary" />
              {t("importTitle")}
            </CardTitle>
            <CardDescription>{t("importDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ImportInventoryForm
              products={autoProducts.map((p) => ({
                id: p.id,
                name: p.name,
                region: p.region,
                variants: p.variants.filter((v) => v.active).map((v) => ({ id: v.id, name: v.name })),
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
