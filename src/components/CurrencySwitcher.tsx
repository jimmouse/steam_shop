"use client";

import { Check, Coins } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CURRENCIES, CURRENCY_META, type Currency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCurrency } from "./Price";

export function CurrencySwitcher({ label, className }: { label: string; className?: string }) {
  const { currency } = useCurrency();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(c: Currency) {
    if (c === currency || busy) return;
    setBusy(true);
    await fetch("/api/currency", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency: c }) });
    setBusy(false);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label={label} className={className} />}>
        <Coins />
        <span className="font-mono text-xs">{currency}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {CURRENCIES.map((c) => (
          <DropdownMenuItem key={c} onClick={() => change(c)} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2">
              <span className="w-10 font-mono text-xs">{c}</span>
              <span className="text-muted-foreground">
                {CURRENCY_META[c].symbol} {CURRENCY_META[c].name}
              </span>
            </span>
            {c === currency && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
