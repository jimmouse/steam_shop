"use client";

import { ArrowLeft, Boxes, CreditCard, LayoutDashboard, Menu, Package, ReceiptText, Store, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./LocaleSwitcher";

const NAV = [
  { href: "/admin", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", key: "orders", icon: ReceiptText },
  { href: "/admin/payments", key: "payments", icon: CreditCard },
  { href: "/admin/tickets", key: "tickets", icon: Ticket },
  { href: "/admin/products", key: "products", icon: Package },
  { href: "/admin/inventory", key: "inventory", icon: Boxes },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const active = "exact" in n && n.exact ? pathname === n.href : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-sidebar-accent font-medium text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <n.icon className={cn("size-4", active && "text-primary")} />
            {t(n.key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ appName, children }: { appName: string; children: React.ReactNode }) {
  const t = useTranslations("nav");
  const tn = useTranslations("admin.nav");
  const tl = useTranslations("locale");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = NAV.find((n) => ("exact" in n && n.exact ? pathname === n.href : pathname.startsWith(n.href)));

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-e bg-sidebar p-4 md:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2 px-1 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-4" />
          </span>
          <span className="truncate">{appName}</span>
          <span className="ms-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{t("adminBadge")}</span>
        </Link>
        <NavLinks />
        <div className="mt-auto space-y-1">
          <LocaleSwitcher label={tl("label")} className="w-full justify-start text-muted-foreground" />
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" render={<Link href="/" />}>
            <ArrowLeft className="rtl:rotate-180" />
            {t("backToSite")}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t("menu")} />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <SheetHeader className="p-0 pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Store className="size-4 text-primary" />
                  {appName} · {t("adminBadge")}
                </SheetTitle>
              </SheetHeader>
              <NavLinks onNavigate={() => setOpen(false)} />
              <Button variant="ghost" size="sm" className="mt-4 w-full justify-start text-muted-foreground" render={<Link href="/" />}>
                <ArrowLeft className="rtl:rotate-180" />
                {t("backToSite")}
              </Button>
            </SheetContent>
          </Sheet>
          <span className="font-medium">{current ? tn(current.key) : t("adminBadge")}</span>
          <div className="ms-auto">
            <LocaleSwitcher label={tl("label")} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
