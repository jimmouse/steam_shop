import { z } from "zod";
import { handler, ok, parseBody } from "@/server/lib/api";
import { resetPassword } from "@/server/services/auth";

const schema = z.object({ email: z.email(), code: z.string().length(6), password: z.string().min(8).max(128) });

export const POST = handler(async (req) => {
  const { email, code, password } = await parseBody(req, schema);
  await resetPassword(email, code, password);
  return ok({ reset: true });
});
