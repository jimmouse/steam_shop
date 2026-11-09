import { HelpCircle, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FaqAccordion, siteFaq, typeFaq } from "@/components/FaqAccordion";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TYPES = ["ACCOUNT", "TOPUP", "REGION_CHANGE"] as const;

export default async function FaqPage() {
  const [tf, te, tc] = await Promise.all([getTranslations("faq"), getTranslations("enum"), getTranslations("common")]);
  const raw = (k: string) => tf.raw(k);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={tf("pageTitle")}
        description={tf("pageDesc")}
        action={
          <Button variant="outline" render={<Link href="/tickets/new" />}>
            <LifeBuoy />
            {tc("contactSupport")}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="size-4 text-primary" />
            {tf("generalSection")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FaqAccordion items={siteFaq(raw)} openFirst idPrefix="g" />
        </CardContent>
      </Card>

      {TYPES.map((type) => {
        const items = typeFaq(raw, type);
        if (items.length === 0) return null;
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle>{te(type)}</CardTitle>
            </CardHeader>
            <CardContent>
              <FaqAccordion items={items} idPrefix={type} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
