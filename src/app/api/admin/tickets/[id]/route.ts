import { handler, ok, serialize, type RouteCtx } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { getTicketForAdmin } from "@/server/services/tickets";

export const GET = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => {
  await requireRole("ADMIN");
  const { id } = await params;
  return ok(serialize(await getTicketForAdmin(id)));
});
