"use client";

import { LifeBuoy, LogIn, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { ApiForm } from "@/components/ApiForm";
import { Price } from "@/components/Price";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ProductInputField, VariantView } from "@/server/services/products";

interface Props {
  slug: string;
  auto: boolean;
  basePrice: string;
  stock: number | null;
  variants: (VariantView & { label: string })[];
  fields: ProductInputField[];
  expireMinutes: string;
  /** 是否已登录；未登录只展示价格/规格 + 登录按钮 */
  loggedIn: boolean;
}

/** 价格 + 规格选择（任何状态都显示）+ 下单表单 / 登录提示 / 缺货提示 */
export function ProductOrderForm({ slug, auto, basePrice, stock, variants, fields, expireMinutes, loggedIn }: Props) {
  const t = useTranslations("product");
  const hasVariants = variants.length > 0;
  const [variantId, setVariantId] = useState<string | null>(() => variants.find((v) => v.stock === null || v.stock > 0)?.id ?? variants[0]?.id ?? null);
  const selected = variants.find((v) => v.id === variantId) ?? null;

  const unitPrice = selected ? selected.price : basePrice;
  const available = hasVariants ? (selected?.stock ?? null) : stock;
  const soldOut = available !== null && available <= 0;
  const allSoldOut = hasVariants ? variants.every((v) => v.stock !== null && v.stock <= 0) : soldOut;
  const maxQty = Math.min(20, available ?? 20);

  const variantPicker = hasVariants && (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{t("variant")}</legend>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const out = v.stock !== null && v.stock <= 0;
          const active = v.id === variantId;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setVariantId(v.id)}
              aria-pressed={active}
              className={cn(
                "rounded-lg border px-3 py-2 text-start text-sm transition-colors",
                active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                out && "opacity-60",
              )}
            >
              <span className={cn("block font-medium", out && "line-through")}>
                {v.label}
              </span>
              <span className="block text-xs">
                <Price usd={v.price} size="sm" showUsd={false} className="font-normal" />
                {v.stock !== null && !out && <span className="ms-1 text-muted-foreground">· {v.stock}</span>}
                {out && <span className="ms-1 text-destructive">· {t("variantOutOfStock")}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">{t("price")}</p>
        <Price usd={unitPrice} size="xl" className="text-primary" />
      </div>

      {!loggedIn ? (
        <>
          {variantPicker}
          <Alert>
            <LogIn />
            <AlertDescription>{t("loginHint")}</AlertDescription>
          </Alert>
          <Button className="w-full" size="lg" render={<Link href={`/login?next=/products/${slug}`} />}>
            {t("loginToBuy")}
          </Button>
        </>
      ) : allSoldOut ? (
        <>
          {variantPicker}
          <Alert>
            <AlertDescription>{t("outOfStockHint")}</AlertDescription>
          </Alert>
          <Button variant="outline" className="w-full" render={<Link href="/tickets/new" />}>
            <LifeBuoy />
            {t("contactUs")}
          </Button>
        </>
      ) : (
        <ApiForm
          action="/api/orders"
          redirectTo="/orders/{id}"
          transform={(d) => {
            const { quantity, variantId: v, ...rest } = d;
            return { productSlug: slug, quantity: Number(quantity || 1), variantId: v || undefined, customerInput: rest };
          }}
          className="space-y-4"
        >
          {hasVariants && <input type="hidden" name="variantId" value={variantId ?? ""} />}
          {variantPicker}
          {auto && !soldOut && (
            <div className="space-y-1.5">
              <Label htmlFor="quantity">{t("quantity")}</Label>
              <Input id="quantity" name="quantity" type="number" min={1} max={maxQty} defaultValue={1} className="w-28" dir="ltr" />
            </div>
          )}
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
              <Input id={f.key} name={f.key} required={f.required} placeholder={f.placeholder} />
            </div>
          ))}
          <Button type="submit" size="lg" className="w-full" disabled={soldOut || (hasVariants && !variantId)}>
            <ShoppingCart />
            {soldOut ? t("outOfStock") : t("orderNow")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t("expireHint", { min: expireMinutes })}</p>
        </ApiForm>
      )}
    </div>
  );
}
