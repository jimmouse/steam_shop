import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { adminCompleteOrder } from "@/server/services/orders";

const schema = z.object({ deliveryPayload: z.string().max(10000).optional().or(z.literal("")) });

export const POST = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  await requireRole("ADMIN");
  const { id } = await params;
  const { deliveryPayload } = await parseBody(req, schema);
  await adminCompleteOrder(id, deliveryPayload || undefined);
  return ok({ completed: true });
});
