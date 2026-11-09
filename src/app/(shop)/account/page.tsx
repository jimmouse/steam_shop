import { Link2, Mail, MessageCircle, ShieldCheck, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { ApiForm } from "@/components/ApiForm";
import { SendCodeButton } from "@/components/SendCodeButton";
import { TelegramLoginButton } from "@/components/TelegramLoginButton";
import { telegramLoginAvailability } from "@/server/lib/telegram";
import { PageHeader } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTranslations } from "next-intl/server";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/lib/session";
import { listIdentities } from "@/server/services/auth";

export const dynamic = "force-dynamic";

const PROVIDER_ICON = { EMAIL: Mail, TELEGRAM: MessageCircle, DISCORD: MessageCircle } as const;

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const [{ t, te, dateShort }, identities, ta] = await Promise.all([getI18n("account"), listIdentities(user.id), getTranslations("auth")]);
  const hasEmail = identities.some((i) => i.provider === "EMAIL");
  const hasTelegram = identities.some((i) => i.provider === "TELEGRAM");
  const tgLogin = telegramLoginAvailability();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} description={t("desc")} />

      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Wallet className="size-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{t("balance")}</p>
                <p className="font-mono text-lg font-semibold" dir="ltr">
                  {Number(user.balance).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">USD</span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{t("role")}</p>
                <p className="text-lg font-semibold">{user.role === "ADMIN" ? t("roleAdmin") : t("roleUser")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-4 text-primary" />
              {t("identitiesTitle")}
            </CardTitle>
            <CardDescription>{t("identitiesDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {identities.map((i) => {
                const Icon = PROVIDER_ICON[i.provider];
                return (
                  <li key={i.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm" dir="ltr">
                        {i.displayName ?? i.providerUid}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("boundOn", { provider: te(i.provider), date: dateShort(i.createdAt) })}</p>
                    </div>
                    <Badge variant="secondary" className="bg-success/15 text-success">
                      {t("verified")}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {!hasEmail && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-4 text-primary" />
                {t("bindEmail.title")}
              </CardTitle>
              <CardDescription>{t("bindEmail.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertDescription>{t("bindEmail.mergeHint")}</AlertDescription>
              </Alert>
              <ApiForm action="/api/me/bind-email" successMessage={t("bindEmail.success")} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{ta("email")}</Label>
                  <Input id="email" name="email" type="email" required dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="code">{ta("code")}</Label>
                  <div className="flex items-start gap-2">
                    <Input id="code" name="code" required maxLength={6} inputMode="numeric" className="font-mono tracking-widest" dir="ltr" />
                    <SendCodeButton purpose="BIND_EMAIL" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">
                    {t("bindEmail.passwordLabel")} <span className="font-normal text-muted-foreground">{t("bindEmail.passwordHint")}</span>
                  </Label>
                  <Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" dir="ltr" />
                </div>
                <Button type="submit">{t("bindEmail.btn")}</Button>
              </ApiForm>
            </CardContent>
          </Card>
        )}

        {!hasTelegram && tgLogin !== "hidden" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="size-4 text-[#2AABEE]" />
                {t("bindTelegram.title")}
              </CardTitle>
              <CardDescription>{t("bindTelegram.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <TelegramLoginButton endpoint="/api/me/bind-telegram" redirectTo="/account" mode={tgLogin} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
