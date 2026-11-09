import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";

export default async function ShopLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("nav");
  const name = process.env.APP_NAME ?? "Steam Store";
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:py-10">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {name}
          </span>
          <nav className="flex gap-4">
            <Link href="/faq" className="hover:text-foreground">
              {t("help")}
            </Link>
            <a href="#" className="hover:text-foreground">
              Telegram
            </a>
            <a href="#" className="hover:text-foreground">
              Discord
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
