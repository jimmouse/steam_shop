"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiForm } from "@/components/ApiForm";
import { MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOCALES } from "@/i18n/config";

interface Variant {
  id: string;
  name: string;
  i18n: Record<string, string> | null;
  price: string;
  sortOrder: number;
  active: boolean;
  stock: number | null;
}

/** 后台规格行：查看态 ↔ 行内编辑态（名称 / 价格 / 排序 / 各语言名 / 删除） */
export function VariantRow({ v }: { v: Variant }) {
  const t = useTranslations("admin.products");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/admin/variants/${v.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setDeleteError(json?.error?.message ?? "Error");
      return;
    }
    router.refresh();
  }

  if (!editing) {
    return (
      <li className={`flex items-center gap-3 py-1.5 text-sm ${v.active ? "" : "opacity-50"}`}>
        <span className="w-32 font-mono" dir="ltr">
          {v.name}
        </span>
        <MoneyText amount={v.price} currency="USD" size="sm" />
        {v.stock !== null && <span className={`text-xs ${v.stock > 0 ? "text-success" : "text-destructive"}`}>{t("stock", { n: v.stock })}</span>}
        {v.i18n && Object.keys(v.i18n).length > 0 && (
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            {Object.entries(v.i18n)
              .map(([k, val]) => `${k}: ${val}`)
              .join(" · ")}
          </span>
        )}
        <span className="ms-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setEditing(true)}>
            <Pencil />
            {t("edit")}
          </Button>
          <ApiForm action={`/api/admin/variants/${v.id}`} method="PATCH" transform={() => ({ active: !v.active })}>
            <Button type="submit" variant="ghost" size="xs" className="text-muted-foreground">
              {v.active ? t("unlist") : t("list")}
            </Button>
          </ApiForm>
        </span>
      </li>
    );
  }

  return (
    <li className="py-2">
      <ApiForm
        action={`/api/admin/variants/${v.id}`}
        method="PATCH"
        successMessage={t("saved")}
        onSuccess={() => setEditing(false)}
        transform={(d) => {
          const i18n: Record<string, string> = {};
          for (const l of LOCALES) if (d[`i18n_${l}`]?.trim()) i18n[l] = d[`i18n_${l}`].trim();
          return { name: d.name, price: d.price, sortOrder: Number(d.sortOrder || 0), i18n: Object.keys(i18n).length ? i18n : null };
        }}
        className="space-y-3 rounded-lg border bg-background/60 p-3"
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`n-${v.id}`} className="text-xs">
              {t("variantName")}
            </Label>
            <Input id={`n-${v.id}`} name="name" required defaultValue={v.name} maxLength={60} className="h-8 w-40 text-xs" dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`p-${v.id}`} className="text-xs">
              {t("variantPrice")}
            </Label>
            <Input id={`p-${v.id}`} name="price" required type="number" step="0.01" min="0" defaultValue={v.price} className="h-8 w-28 text-xs" dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`s-${v.id}`} className="text-xs">
              #
            </Label>
            <Input id={`s-${v.id}`} name="sortOrder" type="number" defaultValue={v.sortOrder} className="h-8 w-16 text-xs" dir="ltr" />
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{t("variantI18n")}</p>
          <div className="grid gap-2 sm:grid-cols-4">
            {LOCALES.map((l) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-6 font-mono text-[11px] text-muted-foreground">{l}</span>
                <Input name={`i18n_${l}`} defaultValue={v.i18n?.[l] ?? ""} className="h-8 text-xs" dir={l === "ar" ? "rtl" : "ltr"} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            <Check />
            {t("save")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X />
            {t("cancelEdit")}
          </Button>
          <span className="ms-auto">
            <Button type="button" size="sm" variant="destructive" disabled={deleting} onClick={remove}>
              <Trash2 />
              {t("delete")}
            </Button>
          </span>
        </div>
        {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
      </ApiForm>
    </li>
  );
}
