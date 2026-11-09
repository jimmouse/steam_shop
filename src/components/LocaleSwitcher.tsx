"use client";

import { Check, Globe } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LOCALES, LOCALE_META, type Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function LocaleSwitcher({ label, className }: { label: string; className?: string }) {
  const current = useLocale() as Locale;
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(locale: Locale) {
    if (locale === current || busy) return;
    setBusy(true);
    await fetch("/api/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
    setBusy(false);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label={label} className={className} />}>
        <Globe />
        <span className="hidden sm:inline">{LOCALE_META[current].name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((code) => (
          <DropdownMenuItem key={code} onClick={() => change(code)} className="flex items-center justify-between gap-6">
            <span dir={LOCALE_META[code].dir}>{LOCALE_META[code].name}</span>
            {code === current && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
