import { OrderStatus } from "@prisma/client";
import { handler, ok, serialize } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { listAllOrders } from "@/server/services/orders";

export const GET = handler(async (req) => {
  await requireRole("ADMIN");
  const status = new URL(req.url).searchParams.get("status");
  const valid = status && (Object.values(OrderStatus) as string[]).includes(status) ? (status as OrderStatus) : undefined;
  return ok(serialize(await listAllOrders({ status: valid })));
});
