"use client";

import { LayoutDashboard, LifeBuoy, LogOut, Menu, Package, ReceiptText, Store, Ticket, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CurrencySwitcher } from "./CurrencySwitcher";
import { LocaleSwitcher } from "./LocaleSwitcher";

interface Props {
  appName: string;
  user: { role: "USER" | "ADMIN" } | null;
}

export function NavClient({ appName, user }: Props) {
  const t = useTranslations("nav");
  const tl = useTranslations("locale");
  const tcur = useTranslations("currency");
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: t("products"), icon: Package, show: true },
    { href: "/tickets/new", label: t("presale"), icon: LifeBuoy, show: true },
    { href: "/orders", label: t("myOrders"), icon: ReceiptText, show: !!user },
    { href: "/tickets", label: t("myTickets"), icon: Ticket, show: !!user },
    { href: "/account", label: t("account"), icon: UserRound, show: !!user },
    { href: "/admin", label: t("admin"), icon: LayoutDashboard, show: user?.role === "ADMIN", accent: true },
  ].filter((l) => l.show);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-4" />
          </span>
          {appName}
        </Link>

        <nav className="ms-6 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                isActive(l.href) && "bg-accent text-foreground",
                l.accent && "text-primary",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <CurrencySwitcher label={tcur("label")} />
          <LocaleSwitcher label={tl("label")} />

          {user ? (
            <Button variant="ghost" size="sm" onClick={logout} className="hidden text-muted-foreground md:inline-flex">
              <LogOut />
              {t("logout")}
            </Button>
          ) : (
            <div className="hidden items-center gap-1 md:flex">
              <Button variant="ghost" size="sm" render={<Link href="/login" />}>
                {t("login")}
              </Button>
              <Button size="sm" render={<Link href="/register" />}>
                {t("register")}
              </Button>
            </div>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={t("menu")} />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Store className="size-4 text-primary" />
                  {appName}
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-2">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                      isActive(l.href) && "bg-accent text-foreground",
                      l.accent && "text-primary",
                    )}
                  >
                    <l.icon className="size-4" />
                    {l.label}
                  </Link>
                ))}
              </nav>
              <Separator className="my-3" />
              <div className="px-4">
                {user ? (
                  <Button variant="outline" className="w-full" onClick={logout}>
                    <LogOut />
                    {t("logoutFull")}
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" render={<Link href="/login" onClick={() => setOpen(false)} />}>
                      {t("login")}
                    </Button>
                    <Button render={<Link href="/register" onClick={() => setOpen(false)} />}>{t("register")}</Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
