import { z } from "zod";
import { handler, ok, parseBody } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { importInventory, inventorySummary } from "@/server/services/products";

const schema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional().or(z.literal("")),
  // 多行文本，每行一条库存
  lines: z.string().min(1),
});

export const GET = handler(async () => {
  await requireRole("ADMIN");
  return ok(await inventorySummary());
});

export const POST = handler(async (req) => {
  await requireRole("ADMIN");
  const { productId, variantId, lines } = await parseBody(req, schema);
  const count = await importInventory(productId, lines.split(/\r?\n/), variantId || null);
  return ok({ imported: count }, { status: 201 });
});
