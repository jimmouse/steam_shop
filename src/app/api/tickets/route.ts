import { z } from "zod";
import { handler, ok, parseBody, serialize } from "@/server/lib/api";
import { requireUser } from "@/server/lib/session";
import { createTicket, listTicketsForUser } from "@/server/services/tickets";

const createSchema = z.object({
  type: z.enum(["PRESALE", "SUPPORT"]),
  subject: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
  orderId: z.string().optional().or(z.literal("")),
});

export const GET = handler(async () => {
  const user = await requireUser();
  return ok(serialize(await listTicketsForUser(user.id)));
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, createSchema);
  const ticket = await createTicket({ userId: user.id, ...body, orderId: body.orderId || undefined });
  return ok(serialize(ticket), { status: 201 });
});
