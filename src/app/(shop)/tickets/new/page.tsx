import { LifeBuoy, LogIn, Mail } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NewTicketForm } from "@/components/forms/NewTicketForm";
import { PageHeader } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/server/lib/session";

export const dynamic = "force-dynamic";

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const [user, { orderId }, t, tn] = await Promise.all([getCurrentUser(), searchParams, getTranslations("tickets"), getTranslations("nav")]);
  const afterSale = !!orderId;

  if (!user) {
    return (
      <div className="mx-auto max-w-md">
        <PageHeader title={t("presaleTitle")} />
        <Card>
          <CardContent className="space-y-4 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <LifeBuoy className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">{t("loginHint")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" render={<Link href="/register" />}>
                {tn("register")}
              </Button>
              <Button render={<Link href="/login?next=/tickets/new" />}>
                <LogIn />
                {tn("login")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={afterSale ? t("afterSaleTitle") : t("presaleTitle")} description={afterSale ? t("afterSaleDesc") : t("presaleDesc")} />
      <Alert className="mb-4">
        <Mail />
        <AlertDescription>{t("emailHint")}</AlertDescription>
      </Alert>
      <Card>
        <CardContent>
          <NewTicketForm orderId={orderId} />
        </CardContent>
      </Card>
    </div>
  );
}
