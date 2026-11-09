import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ApiForm } from "@/components/ApiForm";
import { AuthCard } from "@/components/AuthCard";
import { SendCodeButton } from "@/components/SendCodeButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard
      title={t("forgot.title")}
      description={t("forgot.desc")}
      footer={
        <Link href="/login" className="text-primary hover:underline">
          {t("forgot.backToLogin")}
        </Link>
      }
    >
      <ApiForm action="/api/auth/reset-password" redirectTo="/login" className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="code">{t("code")}</Label>
          <div className="flex items-start gap-2">
            <Input id="code" name="code" required maxLength={6} inputMode="numeric" className="font-mono tracking-widest" dir="ltr" />
            <SendCodeButton purpose="RESET_PASSWORD" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("forgot.newPassword")}</Label>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" />
        </div>
        <Button type="submit" size="lg" className="w-full">
          {t("forgot.btn")}
        </Button>
      </ApiForm>
    </AuthCard>
  );
}
