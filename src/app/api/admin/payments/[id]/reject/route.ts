import { handler, ok, type RouteCtx } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { adminRejectPayment } from "@/server/services/payments";

export const POST = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => {
  await requireRole("ADMIN");
  const { id } = await params;
  await adminRejectPayment(id);
  return ok({ rejected: true });
});
