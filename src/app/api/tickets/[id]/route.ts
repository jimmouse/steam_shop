import { handler, ok, serialize, type RouteCtx } from "@/server/lib/api";
import { requireUser } from "@/server/lib/session";
import { getTicketForUser } from "@/server/services/tickets";

export const GET = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  return ok(serialize(await getTicketForUser(user.id, id)));
});
