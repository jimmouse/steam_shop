import { TicketStatus } from "@prisma/client";
import { handler, ok, serialize } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { listTicketsForAdmin } from "@/server/services/tickets";

export const GET = handler(async (req) => {
  await requireRole("ADMIN");
  const status = new URL(req.url).searchParams.get("status");
  const valid = status && (Object.values(TicketStatus) as string[]).includes(status) ? (status as TicketStatus) : undefined;
  return ok(serialize(await listTicketsForAdmin(valid)));
});
