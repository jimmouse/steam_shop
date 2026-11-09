import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/server/lib/api";
import { requireUser } from "@/server/lib/session";
import { userReply } from "@/server/services/tickets";

const schema = z.object({ body: z.string().min(1).max(5000) });

export const POST = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { body } = await parseBody(req, schema);
  await userReply(user.id, id, body);
  return ok({ sent: true });
});
