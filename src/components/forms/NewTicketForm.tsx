"use client";

import { useTranslations } from "next-intl";
import { ApiForm } from "@/components/ApiForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewTicketForm({ orderId }: { orderId?: string }) {
  const t = useTranslations("tickets");
  const tc = useTranslations("common");
  const afterSale = !!orderId;
  return (
    <ApiForm
      action="/api/tickets"
      redirectTo="/tickets/{id}"
      transform={(d) => ({ ...d, type: afterSale ? "SUPPORT" : "PRESALE", orderId: orderId ?? "" })}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="subject">{t("subject")}</Label>
        <Input id="subject" name="subject" required maxLength={120} placeholder={t("subjectPlaceholder")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body">{t("body")}</Label>
        <Textarea id="body" name="body" required rows={6} maxLength={5000} placeholder={t("bodyPlaceholder")} />
      </div>
      <Button type="submit" size="lg" className="w-full">
        {tc("submit")}
      </Button>
    </ApiForm>
  );
}
