import { handler, ok, type RouteCtx } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { adminRefundOrder } from "@/server/services/orders";

export const POST = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => {
  await requireRole("ADMIN");
  const { id } = await params;
  await adminRefundOrder(id);
  return ok({ refunded: true });
});
