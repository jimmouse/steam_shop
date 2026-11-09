import { handler, ok, type RouteCtx } from "@/server/lib/api";
import { requireUser } from "@/server/lib/session";
import { cancelOrder } from "@/server/services/orders";

export const POST = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await cancelOrder(user.id, id);
  return ok({ cancelled: true });
});
