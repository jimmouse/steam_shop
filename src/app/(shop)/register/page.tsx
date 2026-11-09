import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ApiForm } from "@/components/ApiForm";
import { AuthCard } from "@/components/AuthCard";
import { SendCodeButton } from "@/components/SendCodeButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/server/lib/session";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/account");
  const t = await getTranslations("auth");

  return (
    <AuthCard
      title={t("register.title")}
      description={t("register.desc")}
      footer={
        <>
          {t("register.haveAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("register.loginLink")}
          </Link>
        </>
      }
    >
      <ApiForm action="/api/auth/register" redirectTo="/account" className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="code">{t("code")}</Label>
          <div className="flex items-start gap-2">
            <Input id="code" name="code" required maxLength={6} inputMode="numeric" pattern="\d{6}" placeholder={t("codePlaceholder")} className="font-mono tracking-widest" dir="ltr" />
            <SendCodeButton purpose="REGISTER" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" />
          <p className="text-xs text-muted-foreground">{t("register.passwordHint")}</p>
        </div>
        <Button type="submit" size="lg" className="w-full">
          {t("register.btn")}
        </Button>
      </ApiForm>
    </AuthCard>
  );
}
