import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { LOCALE_META, type Locale } from "@/i18n/config";
import { getCurrencyContext } from "@/lib/currency.server";
import { CurrencyProvider } from "@/components/Price";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const name = process.env.APP_NAME ?? "Steam Store";
  return { title: { default: name, template: `%s · ${name}` }, description: t("description") };
}

export const viewport: Viewport = { themeColor: "#0f141b" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, { currency, rates }] = await Promise.all([getLocale(), getCurrencyContext()]);
  const dir = LOCALE_META[locale as Locale]?.dir ?? "ltr";
  return (
    <html lang={locale} dir={dir} className="dark h-full">
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <CurrencyProvider currency={currency} rates={rates}>
            <TooltipProvider delay={200}>{children}</TooltipProvider>
          </CurrencyProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
