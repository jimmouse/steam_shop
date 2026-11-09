import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface FaqItem {
  q: string;
  a: string;
}

const asList = (v: unknown): FaqItem[] =>
  Array.isArray(v) ? v.filter((x): x is FaqItem => typeof x?.q === "string" && typeof x?.a === "string") : [];

/** 全站通用 FAQ */
export function siteFaq(raw: (key: string) => unknown): FaqItem[] {
  return asList(raw("common"));
}

/** 某商品类型专属 FAQ */
export function typeFaq(raw: (key: string) => unknown, type: "ACCOUNT" | "TOPUP" | "REGION_CHANGE"): FaqItem[] {
  return asList(raw(`byType.${type}`));
}

/** 商品页用：类型专属在前，全站通用在后 */
export function pickCommonFaq(raw: (key: string) => unknown, type?: "ACCOUNT" | "TOPUP" | "REGION_CHANGE"): FaqItem[] {
  return [...(type ? typeFaq(raw, type) : []), ...siteFaq(raw)];
}

export function FaqAccordion({ items, openFirst = false, idPrefix = "faq" }: { items: FaqItem[]; openFirst?: boolean; idPrefix?: string }) {
  if (items.length === 0) return null;
  return (
    <Accordion defaultValue={openFirst ? [`${idPrefix}-0`] : []}>
      {items.map((item, i) => (
        <AccordionItem key={`${idPrefix}-${i}`} value={`${idPrefix}-${i}`}>
          <AccordionTrigger className="text-start text-sm">{item.q}</AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
