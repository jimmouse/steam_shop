"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ApiForm } from "@/components/ApiForm";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProductOpt {
  id: string;
  name: string;
  region: string;
  variants: { id: string; name: string }[];
}

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-80";

export function ImportInventoryForm({ products }: { products: ProductOpt[] }) {
  const t = useTranslations("admin.inventory");
  const tp = useTranslations("admin.products");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId);
  const variants = product?.variants ?? [];

  return (
    <ApiForm action="/api/admin/inventory" resetOnSuccess successMessage={t("imported")} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="productId">{t("product")}</Label>
        <select id="productId" name="productId" required value={productId} onChange={(e) => setProductId(e.target.value)} className={selectClass}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.region})
            </option>
          ))}
        </select>
      </div>
      {variants.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="variantId">{tp("variant")}</Label>
          <select id="variantId" name="variantId" required className={selectClass} key={productId}>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="lines">{t("lines")}</Label>
        <Textarea id="lines" name="lines" required rows={8} className="font-mono text-xs" dir="ltr" placeholder="user1----pass1----mail1@x.com----mailpass1" />
      </div>
      <Button type="submit">
        <Upload />
        {t("import")}
      </Button>
    </ApiForm>
  );
}
