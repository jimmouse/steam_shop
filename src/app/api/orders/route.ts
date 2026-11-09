import { z } from "zod";
import { handler, ok, parseBody, serialize } from "@/server/lib/api";
import { requireUser } from "@/server/lib/session";
import { createOrder, listOrdersForUser } from "@/server/services/orders";

const createSchema = z.object({
  productSlug: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(20).optional(),
  variantId: z.string().min(1).optional(),
  customerInput: z.record(z.string(), z.string()).optional(),
});

export const GET = handler(async () => {
  const user = await requireUser();
  return ok(serialize(await listOrdersForUser(user.id)));
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, createSchema);
  const order = await createOrder({ userId: user.id, ...body, source: "WEB" });
  return ok(serialize(order), { status: 201 });
});
