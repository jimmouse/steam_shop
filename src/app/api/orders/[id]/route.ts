import { handler, ok, serialize, type RouteCtx } from "@/server/lib/api";
import { requireUser } from "@/server/lib/session";
import { getOrderForUser } from "@/server/services/orders";

export const GET = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  return ok(serialize(await getOrderForUser(user.id, id)));
});
