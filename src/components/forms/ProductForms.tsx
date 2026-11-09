"use client";

import { Eye, EyeOff, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { ApiForm } from "@/components/ApiForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ToggleProductActiveForm({ id, active }: { id: string; active: boolean }) {
  const t = useTranslations("admin.products");
  return (
    <ApiForm action={`/api/admin/products/${id}`} method="PATCH" transform={() => ({ active: !active })}>
      <Button type="submit" variant={active ? "outline" : "default"} size="sm">
        {active ? <EyeOff /> : <Eye />}
        {active ? t("unlist") : t("list")}
      </Button>
    </ApiForm>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-muted-foreground"> {children}</span>;
}

export function ToggleVariantActiveForm({ id, active }: { id: string; active: boolean }) {
  const t = useTranslations("admin.products");
  return (
    <ApiForm action={`/api/admin/variants/${id}`} method="PATCH" transform={() => ({ active: !active })}>
      <Button type="submit" variant="ghost" size="xs" className="text-muted-foreground">
        {active ? t("unlist") : t("list")}
      </Button>
    </ApiForm>
  );
}

export function AddVariantForm({ productId }: { productId: string }) {
  const t = useTranslations("admin.products");
  return (
    <ApiForm
      action={`/api/admin/products/${productId}/variants`}
      resetOnSuccess
      successMessage={t("variantAdded")}
      transform={(d) => ({ name: d.name, price: d.price, sortOrder: Number(d.sortOrder || 0) })}
      className="flex flex-wrap items-end gap-2"
    >
      <div className="space-y-1">
        <Label htmlFor={`vn-${productId}`} className="text-xs">
          {t("variantName")}
        </Label>
        <Input id={`vn-${productId}`} name="name" required maxLength={60} placeholder="10 USD" className="h-8 w-40 text-xs" dir="ltr" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`vp-${productId}`} className="text-xs">
          {t("variantPrice")}
        </Label>
        <Input id={`vp-${productId}`} name="price" required type="number" step="0.01" min="0" className="h-8 w-28 text-xs" dir="ltr" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`vs-${productId}`} className="text-xs">
          #
        </Label>
        <Input id={`vs-${productId}`} name="sortOrder" type="number" defaultValue={0} className="h-8 w-16 text-xs" dir="ltr" />
      </div>
      <Button type="submit" size="sm" variant="outline">
        <Plus />
        {t("addVariant")}
      </Button>
    </ApiForm>
  );
}

export function CreateProductForm() {
  const t = useTranslations("admin.products");
  return (
    <ApiForm
      action="/api/admin/products"
      resetOnSuccess
      successMessage={t("created")}
      transform={(d) => ({
        slug: d.slug,
        type: d.type,
        deliveryMode: d.type === "ACCOUNT" ? "AUTO_INVENTORY" : "MANUAL_TICKET",
        region: d.region.toUpperCase(),
        name: d.name,
        description: d.description || null,
        imageUrl: d.imageUrl || null,
        faq: d.faq ? JSON.parse(d.faq) : null,
        i18n: d.i18n ? JSON.parse(d.i18n) : null,
        price: d.price,
        currency: d.currency || "USD",
        inputSchema: d.inputSchema ? JSON.parse(d.inputSchema) : null,
        sortOrder: Number(d.sortOrder || 0),
      })}
      className="grid gap-4 sm:grid-cols-2"
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required placeholder={t("namePlaceholder")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">{t("slug")}</Label>
        <Input id="slug" name="slug" required pattern="[a-z0-9-]+" placeholder="tr-blank-account" className="font-mono" dir="ltr" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type">{t("type")}</Label>
        <select id="type" name="type" defaultValue="ACCOUNT" className={selectClass}>
          <option value="ACCOUNT">{t("typeAccount")}</option>
          <option value="TOPUP">{t("typeTopup")}</option>
          <option value="REGION_CHANGE">{t("typeRegion")}</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="region">{t("region")}</Label>
        <Input id="region" name="region" required placeholder="TR / AR / RU / CN / US" className="font-mono uppercase" dir="ltr" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="price">{t("price")}</Label>
        <Input id="price" name="price" required type="number" step="0.01" min="0" dir="ltr" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="currency">{t("currency")}</Label>
        <Input id="currency" name="currency" defaultValue="USD" maxLength={3} className="font-mono uppercase" dir="ltr" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="imageUrl">
          {t("imageUrl")}
          <Hint>{t("imageUrlHint")}</Hint>
        </Label>
        <Input id="imageUrl" name="imageUrl" type="url" placeholder="https://..." className="font-mono text-xs" dir="ltr" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="faq">
          {t("faq")}
          <Hint>{t("faqHint")}</Hint>
        </Label>
        <Textarea id="faq" name="faq" rows={3} className="font-mono text-xs" dir="ltr" placeholder='[{"q":"...","a":"..."}]' />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="i18n">
          {t("translations")}
          <Hint>{t("translationsHint")}</Hint>
        </Label>
        <Textarea
          id="i18n"
          name="i18n"
          rows={4}
          className="font-mono text-xs"
          dir="ltr"
          placeholder='{"en":{"name":"...","description":"...","faq":[{"q":"...","a":"..."}]},"ru":{...},"ar":{...}}'
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="inputSchema">
          {t("inputSchema")}
          <Hint>{t("inputSchemaHint")}</Hint>
        </Label>
        <Textarea
          id="inputSchema"
          name="inputSchema"
          rows={3}
          className="font-mono text-xs"
          dir="ltr"
          placeholder='[{"key":"steam_login","label":"Steam login","required":true}]'
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sortOrder">{t("sortOrder")}</Label>
        <Input id="sortOrder" name="sortOrder" type="number" defaultValue={0} dir="ltr" />
      </div>
      <div className="flex items-end">
        <Button type="submit" className="w-full">
          <Plus />
          {t("create")}
        </Button>
      </div>
    </ApiForm>
  );
}
