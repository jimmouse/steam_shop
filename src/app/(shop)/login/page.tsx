import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ApiForm } from "@/components/ApiForm";
import { AuthCard } from "@/components/AuthCard";
import { TelegramLoginButton } from "@/components/TelegramLoginButton";
import { telegramLoginAvailability } from "@/server/lib/telegram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/server/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/account");
  const { next } = await searchParams;
  const target = next && next.startsWith("/") ? next : "/account";
  const t = await getTranslations("auth");
  const tgLogin = telegramLoginAvailability();

  return (
    <AuthCard
      title={t("login.title")}
      description={t("login.desc")}
      footer={
        <>
          {t("login.noAccount")}{" "}
          <Link href="/register" className="text-primary hover:underline">
            {t("login.registerLink")}
          </Link>
        </>
      }
    >
      <ApiForm action="/api/auth/login" redirectTo={target} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("password")}</Label>
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
              {t("login.forgot")}
            </Link>
          </div>
          <Input id="password" name="password" type="password" required autoComplete="current-password" dir="ltr" />
        </div>
        <Button type="submit" size="lg" className="w-full">
          {t("login.btn")}
        </Button>
      </ApiForm>

      {tgLogin !== "hidden" && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <TelegramLoginButton endpoint="/api/auth/telegram" redirectTo={target} mode={tgLogin} />
        </>
      )}
    </AuthCard>
  );
}
