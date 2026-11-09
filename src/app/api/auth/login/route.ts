import { z } from "zod";
import { handler, ok, parseBody } from "@/server/lib/api";
import { createSession } from "@/server/lib/session";
import { loginWithPassword } from "@/server/services/auth";

const schema = z.object({ email: z.email(), password: z.string().min(1) });

export const POST = handler(async (req) => {
  const { email, password } = await parseBody(req, schema);
  const userId = await loginWithPassword(email, password);
  await createSession(userId);
  return ok({ userId });
});
