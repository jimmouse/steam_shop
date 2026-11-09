import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { staffReply } from "@/server/services/tickets";

const schema = z.object({
  body: z.string().max(5000).optional().default(""),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"]).optional().or(z.literal("")),
});

export const POST = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  const staff = await requireRole("ADMIN");
  const { id } = await params;
  const { body, status } = await parseBody(req, schema);
  await staffReply(staff.id, id, body, status || undefined);
  return ok({ sent: true });
});
