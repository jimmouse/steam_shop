import { z } from "zod";
import { handler, ok, parseBody } from "@/server/lib/api";
import { createSession } from "@/server/lib/session";
import { registerWithEmail } from "@/server/services/auth";

const schema = z.object({
  email: z.email(),
  code: z.string().length(6),
  password: z.string().min(8).max(128),
});

export const POST = handler(async (req) => {
  const { email, code, password } = await parseBody(req, schema);
  const userId = await registerWithEmail(email, code, password);
  await createSession(userId);
  return ok({ userId });
});
